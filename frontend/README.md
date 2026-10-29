<div align="center">

# 🧠 NeuroScan

**Full-stack Brain Tumour Detection Platform**

Turn a Colab prediction notebook into a real product — frontend · backend · model inference · PostgreSQL

`Next.js 16 (App Router)` · `React 19` · `TypeScript` · `Tailwind CSS 4` · `PostgreSQL` · `Drizzle ORM` · `TensorFlow / ONNX ready`

</div>

---

## 📖 Table of contents

1. Why this project exists
2. Features
3. Architecture
4. Tech stack
5. Project structure
6. Quick start
7. Environment variables
8. The 8-stage pipeline (flowchart)
9. Model providers
10. Connect your own Colab model — step by step
11. API reference
12. Database schema
13. Frontend pages
14. Class taxonomy & severity logic
15. Measured performance
16. Troubleshooting
17. Production hardening checklist
18. Roadmap
19. Disclaimer

---

## 1. Why this project exists

A typical brain-tumour Colab notebook gives you exactly **one half** of an application:

    image in  →  model.predict()  →  print(label)   ✅ done

Everything that makes it a *usable, auditable, multi-user product* is missing:

| Missing in a notebook | Provided by NeuroScan |
|---|---|
| No way for a non-programmer to submit a scan | Drag & drop web UI with instant feedback |
| No pre-processing contract shared with production | Same crop → resize → normalise code path, documented and timed |
| No persistence | Every scan + result stored in PostgreSQL |
| No audit trail | Per-stage execution trace with real millisecond timings |
| No history / search / re-review | History page with filters and per-scan detail view |
| No explainability | Salience heatmap overlay + ROI bounding box |
| Model hard-coded into the UI logic | **Pluggable provider seam** — swap the model without touching the frontend |

> **The key design idea:** the model is *not* baked into the app. It sits behind one interface
> (`src/lib/inference.ts`), so you can go from the built-in demo engine to your own trained weights by
> changing **one environment variable**.

---

## 2. Features

**Frontend**
- 🖱 Drag & drop or click-to-browse MRI upload (PNG/JPEG, 12 MB guard) + 2 built-in demo slices
- ⏱ **Live pipeline animation** while the request is in flight, then replaced by the *real* server-measured timings
- 🎯 Result card: predicted class, animated confidence ring, 4-class softmax bars, severity badge
- 🔥 Canvas **salience heatmap overlay** + dashed ROI box, with opacity slider and toggles
- 🧬 Expandable radiomic feature table (19 features)
- 🧾 Patient context capture (reference/MRN, age, sex, clinical notes)

**Backend**
- 🔌 6 REST endpoints (predict, history, detail, delete, stats, model info, health)
- 🛡 Input validation with precise HTTP status codes (`400 / 413 / 415 / 422`)
- 🔍 Magic-byte codec sniffing — never trusts the browser's `Content-Type`
- 🔀 Three interchangeable inference providers with **automatic graceful fallback**
- 🧩 Response normaliser that accepts **4 different JSON shapes** from external models

**Data & observability**
- 🗄 Two-table PostgreSQL schema via Drizzle ORM
- 📊 Every stage timed and persisted → the `/flowchart` page renders **real average durations**, not a hand-drawn diagram
- 📈 Aggregate stats: totals, class mix, 14-day trend

---

## 3. Architecture

    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                            PRESENTATION LAYER                                │
    │  src/app/page.tsx          Upload → live pipeline → result + overlay        │
    │  src/app/flowchart/        Real per-stage timings read from the database     │
    │  src/app/history/          Filterable history + per-scan detail + delete     │
    │  src/app/guide/            Copy-paste snippets for wiring your own model     │
    └───────────────────────────────────┬──────────────────────────────────────────┘
                                        │  multipart/form-data (fetch)
    ┌───────────────────────────────────▼──────────────────────────────────────────┐
    │                              API LAYER (Node)                                │
    │  POST /api/predict            validate → orchestrate → respond               │
    │  GET  /api/predictions        list + filter (class, search, limit)           │
    │  GET·DELETE /api/predictions/:id   full record + step trace / remove         │
    │  GET  /api/stats              aggregates, class mix, 14-day trend            │
    │  GET  /api/model              active provider + endpoint health probe        │
    │  GET  /api/health             liveness: service + database + provider        │
    └───────────┬───────────────────────────────────────────────────┬──────────────┘
                │                                                   │
    ┌───────────▼───────────────────────────┐   ┌───────────────────▼──────────────┐
    │        INFERENCE LAYER                │   │        DATA LAYER                │
    │  src/lib/pipeline.ts   (orchestrator) │   │  Drizzle ORM  →  PostgreSQL      │
    │  src/lib/image.ts      (decode/crop)  │   │                                  │
    │  src/lib/vision.ts     (features)     │   │  predictions    (1 row / scan)   │
    │  src/lib/inference.ts  (provider seam)│   │  pipeline_steps (1 row / stage)  │
    │                                       │   │                                  │
    │  ┌─────────┬──────────────┬────────┐  │   └──────────────────────────────────┘
    │  │  demo   │    http      │  onnx  │  │
    │  │ built-in│  FastAPI /   │onnxrun-│  │
    │  │ engine  │  TF-Serving  │time-node│ │
    │  └─────────┴──────────────┴────────┘  │
    └───────────────────────────────────────┘

**Request sequence**

    Browser                    Next.js API                 Model provider            PostgreSQL
       |                            |                             |                      |
       |-- POST /api/predict ------>|                             |                      |
       |   (multipart: file)        |-- validate mimetype/size    |                      |
       |                            |-- decode PNG/JPEG bytes     |                      |
       |                            |-- crop + resize 224x224     |                      |
       |                            |-- salience / radiomics      |                      |
       |                            |-- POST file (or tensor) --->|                      |
       |                            |<-- probabilities[4] --------|                      |
       |                            |-- softmax, argmax, severity |                      |
       |                            |-- INSERT prediction ----------------------------> |
       |                            |-- INSERT pipeline_steps -------------------------> |
       |<-- 200 {prediction,steps} -|                             |                      |

---

## 4. Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Server Components + Route Handlers, Turbopack |
| UI | **React 19** + **TypeScript 5.9** | Strict mode, fully typed end to end |
| Styling | **Tailwind CSS 4** | Dark clinical theme, zero component library |
| Imaging | `jpeg-js`, `pngjs` | Pure-JS codecs — no native build step, no ImageMagick |
| ML | **TensorFlow / Keras** (Colab), `onnxruntime-node` optional | Provider seam, pluggable |
| Database | **PostgreSQL** | Two tables, `jsonb` for features/heatmap/trace |
| ORM | **Drizzle ORM** + drizzle-kit | Typed queries, `push` for schema sync |

> **Why pure-JS image codecs?** The whole inference pipeline runs on plain Node — no Python, no system
> libraries, no GPU requirement. That makes the app deployable anywhere a Next.js container runs.

---

## 5. Project structure

    .
    ├── public/samples/
    │   ├── mri-glioma.png                  # demo scan (tumour-like)
    │   └── mri-normal.png                  # demo scan (healthy anatomy)
    │
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                    # Workspace (hero + stats + upload UI)
    │   │   ├── flowchart/page.tsx          # Live flowchart w/ real DB timings
    │   │   ├── history/page.tsx            # Filterable history table
    │   │   ├── history/[id]/page.tsx       # Per-scan detail + recorded trace
    │   │   ├── guide/page.tsx              # Build guide with copy blocks
    │   │   ├── layout.tsx  globals.css     # Shell + theme
    │   │   └── api/
    │   │       ├── health/route.ts         # GET  liveness
    │   │       ├── model/route.ts          # GET  provider info
    │   │       ├── predict/route.ts        # POST inference entry point
    │   │       ├── predictions/route.ts    # GET  list
    │   │       ├── predictions/[id]/route.ts
    │   │       └── stats/route.ts          # GET  aggregates
    │   │
    │   ├── components/
    │   │   ├── Workspace.tsx               # Main interactive client component
    │   │   ├── ScanViewer.tsx              # Canvas: scan + heatmap + ROI box
    │   │   ├── DetailViewer.tsx            # Detail-page overlay controls
    │   │   ├── Nav.tsx  DeleteButton.tsx  CopyBlock.tsx
    │   │
    │   ├── lib/
    │   │   ├── pipeline.ts                 # ⭐ 8-stage orchestrator (times every stage)
    │   │   ├── image.ts                    # decode · centre-crop · resize · normalise
    │   │   ├── vision.ts                   # Otsu mask · asymmetry · blobs · salience
    │   │   ├── inference.ts                # ⭐ provider seam: demo | http | onnx + softmax
    │   │   └── types.ts                    # Shared constants, classes, step metadata
    │   │
    │   └── db/
    │       ├── schema.ts                   # predictions + pipeline_steps
    │       └── index.ts                    # Pooled Drizzle client
    │
    ├── drizzle.config.json                 # drizzle-kit config
    ├── .env                                # DATABASE_URL (+ optional model vars)
    └── README.md

---

## 6. Quick start

### Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | ≥ 20 | `node -v` |
| PostgreSQL | ≥ 14 | `psql --version` |
| npm | ≥ 10 | `npm -v` |

### Steps

    # 1 ── install dependencies
    npm install

    # 2 ── configure the database connection
    echo 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db' > .env

    # 3 ── create the tables (no migration files needed)
    npx drizzle-kit push

    # 4 ── build and run in production mode
    npm run build
    npm start

    # 5 ── verify
    curl http://localhost:3000/api/health
    # {"ok":true,"service":"neuroscan-api","database":"up","modelProvider":"demo",...}

Open **http://localhost:3000**, click one of the two built-in sample scans, then press
**Run prediction pipeline**. You should see all 8 stages light up and a verdict appear.

### Development mode

    npm run dev        # hot reload at http://localhost:3000
    npm run lint       # ESLint
    npm run typecheck  # tsc --noEmit

> **No database handy?** The UI still renders and the inference stages still run — only persistence is
> skipped, and a warning is attached to the response (`persist` step shows `status: error`).

---

## 7. Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `MODEL_PROVIDER` | ❌ | `demo` | `demo` \| `http` \| `onnx` |
| `MODEL_ENDPOINT` | for `http` | — | Full URL of your model service |
| `MODEL_ENDPOINT_MODE` | ❌ | `file` | `file` (multipart upload) \| `tensor` (JSON pixel grid) |
| `MODEL_TOKEN` | ❌ | — | Sent as `Authorization: Bearer …` to the endpoint |
| `MODEL_NAME` | ❌ | `remote-colab-model` | Recorded on every prediction row |
| `MODEL_VERSION` | ❌ | `external` | Recorded on every prediction row |
| `MODEL_TIMEOUT_MS` | ❌ | `20000` | Abort timeout for the model call |
| `ONNX_MODEL_PATH` | for `onnx` | — | Absolute path to exported `.onnx` weights |

Example `.env` for a real model backend:

    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

    MODEL_PROVIDER=http
    MODEL_ENDPOINT=https://a1b2-34-56-78-90.ngrok-free.app/predict
    MODEL_ENDPOINT_MODE=file
    MODEL_TOKEN=super-secret-token
    MODEL_NAME=brain-mri-cnn
    MODEL_VERSION=vgg16-finetune-v3

---

## 8. The 8-stage pipeline (flowchart)

```mermaid
flowchart TD
    A["① Upload & validate<br/><i>Browser → API</i>"] --> B["② Byte decoding<br/><i>magic bytes → RGBA</i>"]
    B --> C["③ Pre-processing<br/><i>centre-crop → 224×224 → /255</i>"]
    C --> D["④ Feature / salience map<br/><i>Otsu mask · asymmetry · blobs</i>"]
    D --> E["⑤ Model forward pass<br/><i>demo · http · onnx</i>"]
    E --> F["⑥ Post-processing<br/><i>softmax → argmax → severity</i>"]
    F --> G["⑦ Persist to PostgreSQL<br/><i>predictions + pipeline_steps</i>"]
    G --> H["⑧ Respond to client<br/><i>JSON + step trace</i>"]

    E -. provider error .-> D2["fallback → demo engine<br/><i>+ providerWarning</i>"]
    D2 -.-> F
```

| # | Stage | Layer | What actually happens |
|---|---|---|---|
| ① | **Upload & validate** | Browser → API | Rejects empty files (`400`), > 12 MB (`413`), non-PNG/JPEG (`415`) **before** any model work |
| ② | **Byte decoding** | API | `FFD8` → `jpeg-js`, `89 50 4E 47` → `pngjs`. Images < 64×64 px rejected (`422`) |
| ③ | **Pre-processing** | ML | Centre-crop to square → area-average resize to **224×224** → Rec.601 grayscale → scale to `[0,1]`. Mirrors `Rescaling(1./255)` from the notebook |
| ④ | **Feature / salience** | ML | Otsu threshold → largest connected component = brain mask; mirrored-hemisphere asymmetry; Sobel gradient energy; hyper-intense blob labelling; chamfer distance-to-rim; 28×28 salience grid |
| ⑤ | **Model forward pass** | ML | Active provider returns 4 raw logits. On failure → automatic demo fallback + warning |
| ⑥ | **Post-processing** | ML | Softmax → argmax → confidence → severity band → clinical recommendation text → ROI box |
| ⑦ | **Persist** | DB | `INSERT INTO predictions` + 8 rows in `pipeline_steps` (status, `duration_ms`, JSON detail) |
| ⑧ | **Respond** | API | JSON containing the result, probabilities, heatmap grid, thumbnail and the **same step trace the UI animated** |

> 🧭 Visit **`/flowchart`** in the running app — it renders this exact pipeline but with
> *average / max durations and run counts queried live from the database*.

---

## 9. Model providers

All three implement the same interface, so the frontend never changes.

| Provider | When to use | Setup | Latency |
|---|---|---|---|
| `demo` *(default)* | Zero ML infrastructure; demoing the product | None | ~0 ms |
| `http` | **Your Colab weights** behind FastAPI / TF-Serving | `MODEL_ENDPOINT` | network-bound |
| `onnx` | Lowest latency, no Python in production | `npm i onnxruntime-node` + `ONNX_MODEL_PATH` | 10–40 ms CPU |

**Automatic graceful degradation.** If `http` or `onnx` throws (unreachable, bad shape, timeout), the API
returns a valid prediction from the demo engine **and** populates `providerWarning` explaining exactly what
failed. The UI never white-screens because a model server rebooted.

### The demo engine (what runs out of the box)

Not a random number generator — it is a deterministic radiomics pipeline:

1. **Otsu thresholding** isolates brain tissue from background/skull
2. **Largest connected component** becomes the brain mask (ellipse fallback if the crop is empty)
3. **Mirrored-hemisphere difference** detects asymmetry (normal brains are close to symmetric)
4. **Sobel gradient energy** captures texture/edge density
5. **Hyper-intense connected components** locate candidate lesions, scored by contrast × area
6. **Geometric descriptors**: area ratio, radius, eccentricity, distance to skull rim, midline shift
7. **Sella-turcica proximity** Gaussian biases toward the pituitary class
8. **Softmax head** (temperature 0.5) converts the four class scores into probabilities

> ⚠️ It is a *heuristic stand-in*, not a trained classifier. Its purpose is to keep the entire product
> demonstrable before you attach real weights. Expect modest accuracy.

---

## 10. Connect your own Colab model — step by step

### Step 1 · Train and export in Colab

    import tensorflow as tf
    from tensorflow.keras import layers

    IMG_SIZE = 224
    CLASSES = ["glioma", "meningioma", "pituitary", "notumor"]   # order matters — record it!

    train_ds = tf.keras.utils.image_dataset_from_directory(
        "Training", image_size=(IMG_SIZE, IMG_SIZE), color_mode="grayscale",
        batch_size=32, label_mode="categorical")
    val_ds = tf.keras.utils.image_dataset_from_directory(
        "Testing", image_size=(IMG_SIZE, IMG_SIZE), color_mode="grayscale",
        batch_size=32, label_mode="categorical")

    model = tf.keras.Sequential([
        layers.Rescaling(1./255, input_shape=(IMG_SIZE, IMG_SIZE, 1)),
        layers.Conv2D(32, 3, activation="relu"), layers.MaxPooling2D(),
        layers.Conv2D(64, 3, activation="relu"), layers.MaxPooling2D(),
        layers.Conv2D(128, 3, activation="relu"), layers.MaxPooling2D(),
        layers.Flatten(), layers.Dropout(0.4),
        layers.Dense(128, activation="relu"),
        layers.Dense(len(CLASSES), activation="softmax"),
    ])
    model.compile("adam", "categorical_crossentropy", metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=15)

    from google.colab import drive
    drive.mount("/content/drive")
    model.save("/content/drive/MyDrive/brain_tumor_model.keras")

**Optional — export ONNX for in-process Node inference:**

    pip install tf2onnx
    import tf2onnx
    spec = (tf.TensorSpec((1, IMG_SIZE, IMG_SIZE, 1), tf.float32, name="input"),)
    tf2onnx.convert_keras(model, spec, opset=13,
                          output_path="/content/drive/MyDrive/bt_model.onnx")

### Step 2 · Wrap the artefact in FastAPI

    # serve_model.py   →   uvicorn serve_model:app --host 0.0.0.0 --port 8000
    import io, numpy as np, tensorflow as tf
    from fastapi import FastAPI, File, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from PIL import Image

    IMG_SIZE = 224
    CLASSES = ["glioma", "meningioma", "pituitary", "notumor"]
    model = tf.keras.models.load_model("brain_tumor_model.keras")

    app = FastAPI(title="Brain Tumour Model API")
    app.add_middleware(CORSMiddleware, allow_origins=["*"],
                       allow_methods=["*"], allow_headers=["*"])

    @app.get("/health")
    def health():
        return {"ok": True}

    @app.post("/predict")
    async def predict(file: UploadFile = File(...)):
        # ⚠️ pre-processing MUST mirror the notebook exactly
        img = Image.open(io.BytesIO(await file.read())).convert("L")
        w, h = img.size
        side = min(w, h)                                   # centre-crop to square
        img = img.crop(((w-side)//2, (h-side)//2, (w+side)//2, (h+side)//2))
        img = img.resize((IMG_SIZE, IMG_SIZE))             # resize to 224×224
        x = (np.asarray(img, dtype=np.float32) / 255.0).reshape(1, IMG_SIZE, IMG_SIZE, 1)

        probs = model.predict(x, verbose=0)[0]
        return {"probabilities": {c: float(p) for c, p in zip(CLASSES, probs)},
                "predicted_class": CLASSES[int(np.argmax(probs))],
                "confidence": float(np.max(probs))}

### Step 3 · Expose the service

| Option | Command | Best for |
|---|---|---|
| **Local** | `uvicorn serve_model:app --port 8000` | `MODEL_ENDPOINT=http://127.0.0.1:8000/predict` |
| **Instant demo** | `pip install pyngrok` → `ngrok.connect(8000).public_url` | Live Colab demo (URL changes each run) |
| **Container** | `docker build -t bt-api . && docker run -p 8000:8000 bt-api` | Repeatable deploys |
| **Managed** | Cloud Run / Fly.io / Railway | Production |

Dockerfile:

    FROM python:3.11-slim
    WORKDIR /app
    COPY . .
    RUN pip install fastapi uvicorn pillow numpy tensorflow python-multipart
    EXPOSE 8000
    CMD ["uvicorn","serve_model:app","--host","0.0.0.0","--port","8000"]

### Step 4 · Point NeuroScan at it

    MODEL_PROVIDER=http
    MODEL_ENDPOINT=https://xxxx.ngrok-free.app/predict

### Step 5 · Verify the bridge

    # which provider is active, and is the endpoint reachable?
    curl -s localhost:3000/api/model | python3 -m json.tool

    # end-to-end round trip
    curl -s -X POST localhost:3000/api/predict \
      -F "file=@mri-slice.jpg" -F "patientRef=MRN-1042" | python3 -m json.tool

### Response shapes the bridge already understands

`src/lib/inference.ts` tries each of these in turn, so most notebooks work with **zero changes**:

| Shape | Typical source |
|---|---|
| `{"probabilities": [0.02, 0.90, 0.05, 0.03]}` | Keras / FastAPI list |
| `{"probabilities": {"glioma": 0.90, ...}}` | Keyed dict |
| `{"predictions": [[0.02, 0.90, 0.05, 0.03]]}` | TF-Serving classify output |
| `[0.02, 0.90, 0.05, 0.03]` | Bare array |

Nested arrays are flattened, and a keyed dict is matched case-insensitively by class key **or** label.

---

## 11. API reference

Base URL: `http://localhost:3000`

### `GET /api/health`
Liveness probe. Verifies the database round trip.

    {"ok":true,"service":"neuroscan-api","database":"up","modelProvider":"demo","time":"2026-08-26T15:45:10.078Z"}

### `POST /api/predict`

**Option A — multipart/form-data** (what the UI uses)

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | binary | ✅ | PNG or JPEG, ≤ 12 MB, ≥ 64×64 px |
| `patientRef` | string | ❌ | MRN / reference |
| `patientAge` | number | ❌ | |
| `patientSex` | string | ❌ | `female` \| `male` \| `other` |
| `notes` | string | ❌ | Clinical notes |

**Option B — application/json**

    {"imageBase64": "data:image/png;base64,iVBORw0KG...", "patientRef": "MRN-1042"}

**Response `200`** (abridged)

    {
      "ok": true,
      "prediction": {
        "publicId": "prd_1ae38001cb35",
        "predictedClass": "glioma",
        "predictedLabel": "Glioma",
        "tumorDetected": true,
        "confidence": 0.4549,
        "severity": "moderate",
        "recommendation": "Model flags a possible glioma. Correlate with other slices…",
        "probabilities": [
          {"key": "glioma", "label": "Glioma", "probability": 0.4549, "color": "#f43f5e"},
          {"key": "meningioma", "label": "Meningioma", "probability": 0.4062, "color": "#f59e0b"},
          {"key": "pituitary", "label": "Pituitary adenoma", "probability": 0.0437, "color": "#8b5cf6"},
          {"key": "notumor", "label": "No tumour", "probability": 0.0952, "color": "#22c55e"}
        ],
        "features": {"brainAreaRatio": 0.377, "asymmetry": 0.265, "lesionAreaRatio": 0.039},
        "heatmap": {"resolution": 28, "values": [0, 0, 0.12, 0.87]},
        "thumbnailDataUrl": "data:image/png;base64,...",
        "sourceWidth": 1024, "sourceHeight": 1024, "inputSize": 224,
        "provider": "demo", "modelName": "radiomics-demo-engine", "modelVersion": "1.0.0",
        "decodeMs": 57, "preprocessMs": 19, "inferenceMs": 0, "totalMs": 140,
        "providerWarning": null, "createdAt": "2026-08-26T15:45:11.000Z"
      },
      "steps": [
        {"stepKey": "upload", "stepIndex": 0, "stepName": "Upload & validate",
         "status": "ok", "durationMs": 0,
         "detail": {"filename": "mri-glioma.png", "bytes": 245760, "mimeType": "image/png"}}
      ]
    }

**Errors**

| Status | Cause |
|---|---|
| `400` | Missing `file` field / empty `imageBase64` / empty file |
| `413` | File exceeds 12 MB |
| `415` | Not a PNG or JPEG |
| `422` | Decoded image smaller than 64×64 px |
| `500` | Unexpected failure |

### `GET /api/predictions`

Query params: `limit` (default 25, max 100) · `class` (`glioma` \| `meningioma` \| `pituitary` \| `notumor` \| `all`) · `q` (ILIKE over filename / patient ref / label)

    curl -s "localhost:3000/api/predictions?limit=5&class=glioma&q=MRN"

### `GET /api/predictions/:id`
Accepts either the numeric `id` or the `publicId`. Returns the full row plus the ordered `pipeline_steps` trace.

### `DELETE /api/predictions/:id`
Deletes the prediction; step rows cascade.

### `GET /api/stats`

    {"ok":true,
     "summary":{"total":4,"tumorCount":2,"avgConfidence":0.64,"avgTotalMs":88.25,"avgInferenceMs":0},
     "byClass":[{"key":"glioma","label":"Glioma","count":2,"avgConfidence":0.45}],
     "trend":[{"day":"2026-08-26","count":4,"tumors":2}]}

### `GET /api/model`
Active provider, class taxonomy, configured endpoint and a reachability probe. Use this to debug wiring.

---

## 12. Database schema

### `predictions` — one row per scan

| Column | Type | Purpose |
|---|---|---|
| `id` | `serial` PK | Internal |
| `public_id` | `varchar(40)` UNIQUE | Shown in UI / used in URLs (`prd_…`) |
| `filename` · `mime_type` · `file_size_bytes` | | Original upload metadata |
| `source_width` · `source_height` · `input_size` | | Provenance |
| `patient_ref` · `patient_age` · `patient_sex` · `notes` | nullable | Clinical context |
| `provider` · `model_name` · `model_version` | | Which model produced this — essential for auditing |
| `predicted_class` · `predicted_label` | | Argmax result |
| `tumor_detected` | `boolean` | `predicted_class != 'notumor'` |
| `confidence` | `real` | Winning probability |
| `severity` | `varchar(24)` | `none` \| `low` \| `moderate` \| `high` |
| `recommendation` | `text` | Human-readable guidance |
| `probabilities` | `jsonb` | All 4 class probabilities + colours |
| `features` | `jsonb` | 19 radiomic descriptors |
| `heatmap` | `jsonb` | `{resolution, values[]}` salience grid |
| `thumbnail_data_url` | `text` | Pre-processed 224×224 slice as base64 PNG |
| `decode_ms` · `preprocess_ms` · `inference_ms` · `total_ms` | | Latency accounting |
| `provider_warning` | nullable text | Fallback explanation |
| `created_at` | `timestamptz` | |

### `pipeline_steps` — one row per executed stage

| Column | Type | Purpose |
|---|---|---|
| `id` | `serial` PK | |
| `prediction_id` | FK → `predictions.id` **ON DELETE CASCADE** | |
| `step_index` · `step_key` · `step_name` | | Ordering + identity |
| `status` | `varchar(16)` | `ok` \| `skipped` \| `error` |
| `duration_ms` | `integer` | Measured with `performance.now()` |
| `detail` | `jsonb` | Stage-specific key/value evidence |
| `created_at` | `timestamptz` | |

Recreate with:

    npx drizzle-kit push
    # reset everything:
    psql "$DATABASE_URL" -c "TRUNCATE predictions, pipeline_steps RESTART IDENTITY"

---

## 13. Frontend pages

| Route | Type | Description |
|---|---|---|
| `/` | Server + Client | Workspace: hero with live DB stats, upload panel, animated pipeline, result & overlay |
| `/flowchart` | Server | Architecture diagram, 8-stage timeline **with real average/max durations and run counts**, ASCII request sequence |
| `/history` | Server | Aggregate counters + filterable table (class, free-text) |
| `/history/[id]` | Server | Full record: overlay viewer, softmax bars, recommendation, recorded per-stage trace bars, delete |
| `/guide` | Server | The 10 necessary steps + 6 copy-paste code blocks |

---

## 14. Class taxonomy & severity logic

| Class | Key | Colour | Imaging signature |
|---|---|---|---|
| Glioma | `glioma` | 🔴 `#f43f5e` | Infiltrative, irregular borders, off-midline white matter |
| Meningioma | `meningioma` | 🟠 `#f59e0b` | Well-circumscribed, peripheral, hugging the skull rim |
| Pituitary adenoma | `pituitary` | 🟣 `#8b5cf6` | Central, mid-line, low — sella turcica |
| No tumour | `notumor` | 🟢 `#22c55e` | Symmetric hemispheres, no mass effect |

Severity is assigned in `src/lib/pipeline.ts` when a tumour is detected:

| Severity | Condition |
|---|---|
| `high` | lesion area ≥ 6 % of brain **or** confidence ≥ 92 % |
| `moderate` | lesion area ≥ 2 % **or** confidence ≥ 75 % |
| `low` | anything else |
| `none` | no tumour detected |

---

## 15. Measured performance

Typical production-mode timings on a 1024×1024 PNG, single container, demo provider:

| Stage | Typical time |
|---|---|
| ① Upload & validate | < 1 ms |
| ② Decode | ~55 ms |
| ③ Pre-process | ~20 ms |
| ④ Feature / salience | ~45 ms |
| ⑤ Inference (demo) | < 1 ms |
| ⑥ Post-process (incl. thumbnail encode) | ~18 ms |
| ⑦ Persist | ~12 ms |
| **Total** | **≈ 140 ms** |

Swap in a real CNN via ONNX on CPU and expect the inference stage to dominate at roughly **10–40 ms per slice**.

---

## 16. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `DATABASE_URL is required` | `.env` missing | Create it — see Quick start |
| `/api/health` → `{"ok":false,"database":"down"}` | Postgres not running, or wrong credentials | Start Postgres; verify `psql "$DATABASE_URL" -c 'select 1'` |
| `relation "predictions" does not exist` | Schema not pushed | `npx drizzle-kit push` |
| Prediction succeeds but `persist` step shows `error` | Tables missing / permissions | Push schema; check grants |
| `providerWarning: Configured provider "http" failed …` | Endpoint down, timeout, or malformed JSON | `curl $MODEL_ENDPOINT` directly; check `/api/model` probe |
| Result is always `notumor` with the demo engine | Input is not an axial brain slice, or is too dark | Use a T1/T2 axial slice; the demo engine needs visible brain tissue |
| Same image, different result than in Colab | **Pre-processing mismatch** — the #1 cause of notebook-vs-production drift | Match colour mode, crop strategy and `1/255` scaling exactly |
| `415 Unsupported` despite a `.jpg` file | Extension lies, magic bytes win | Re-export the file as real JPEG/PNG |
| `413 File too large` | > 12 MB | Downscale or recompress the slice |

---

## 17. Production hardening checklist

- [ ] **Auth** on `/api/predict` (NextAuth / Clerk / JWT) — inference is the expensive endpoint
- [ ] **Rate limiting** per IP and per API key
- [ ] Move uploads to **object storage** (S3/R2) instead of inline base64 thumbnails if volume grows
- [ ] **Job queue** (BullMQ / Inngest) for batch or long-running inference
- [ ] Set `MODEL_TOKEN` and put the model service on a **private network**
- [ ] **DICOM support** + window/level (W/L) adjustment for real PACS input
- [ ] Model **versioning + rollback**; record weights hash on each row (already supported via `model_version`)
- [ ] **Monitoring**: alert on confidence drift, class-distribution shift, p95 latency
- [ ] **Ground-truth capture**: let a radiologist confirm/correct each prediction to build a fine-tuning set
- [ ] **Data governance**: PHI field minimisation, encryption at rest, audit log, retention policy
- [ ] Regulatory review — see the disclaimer below

---

## 18. Roadmap

- [ ] DICOM (.dcm) parsing and multi-slice 3D volume inference
- [ ] Grad-CAM computed from real CNN convolution layers (replacing the heuristic salience map)
- [ ] Batch ZIP upload with a progress queue
- [ ] CSV/PDF report export per scan
- [ ] Radiologist annotation overlay and confirmation workflow
- [ ] Multi-language UI
- [ ] Docker Compose for one-command app + Postgres + model service

---

## 19. Disclaimer

> ⚠️ **This is a research and educational prototype. It is not a certified medical device and has not been
> reviewed by any regulatory authority (FDA / CE / CDSCO).**
>
> Outputs are probabilistic screening signals derived from a single 2-D MRI slice. They can be wrong —
> including confidently wrong. Do **not** use this software for diagnosis, treatment decisions, or triage.
> Every prediction must be interpreted by a qualified radiologist alongside the full imaging series,
> clinical history and laboratory findings.

---

<div align="center">

**Built with Next.js · Drizzle · PostgreSQL**

</div>

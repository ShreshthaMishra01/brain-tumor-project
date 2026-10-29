import { useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";
const classes = [
  ["glioma", "Glioma"], ["meningioma", "Meningioma"],
  ["notumor", "No Tumor"], ["pituitary", "Pituitary"]
];

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function selectFile(f) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Please upload a JPG, JPEG or PNG image.");
      return;
    }
    setError(""); setResult(null); setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setLoading(true); setError(""); setResult(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch(`${API_URL}/predict`, { method: "POST", body });
      if (!res.ok) throw new Error();
      setResult(await res.json());
    } catch {
      setError("Backend not reachable. Keep FastAPI running on port 8000.");
    } finally { setLoading(false); }
  }

  function reset() {
    setFile(null); setPreview(""); setResult(null); setError("");
  }

  const label = (key) => classes.find(([k]) => k === key)?.[1] || key;

  return (
    <div className="app">
      <header>
        <div className="brand"><b>✦</b><div><strong>CerebroSight</strong><small>AI Brain Scan Analysis</small></div></div>
        
      </header>

      <main>
        <section className="hero">
          <div>
            <small className="eyebrow">AI-POWERED MRI CLASSIFICATION</small>
            <h1>Turn an MRI scan into an <em>intelligent prediction.</em></h1>
            <p>Upload a brain MRI and classify it across four categories with probability scores using your trained EfficientNetB0 model.</p>
          </div>
          <div className="visual"><div className="rings">◎</div><small>AI SCAN</small><p>Intelligent image analysis</p></div>
        </section>

        <section className="grid">
          <div className="card">
            <div className="heading"><span>01</span><div><h2>Upload MRI</h2><p>JPG, JPEG or PNG</p></div>{file && <button onClick={reset}>Reset</button>}</div>
            <label className={`drop ${dragging ? "drag" : ""}`}>
              {preview ? <img src={preview} alt="MRI preview" /> :
                <><div className="upload">↑</div><strong>Drop your MRI here</strong><span>or click to browse</span></>}
              <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={e => selectFile(e.target.files?.[0])}
                onDragOver={e => {e.preventDefault(); setDragging(true)}} onDragLeave={() => setDragging(false)}
                onDrop={e => {e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files?.[0])}} />
            </label>
            {file && <div className="file"><b>MRI</b><div><strong>{file.name}</strong><span>{(file.size/1024).toFixed(1)} KB · Ready</span></div></div>}
            <button className="analyze" disabled={!file || loading} onClick={analyze}>
              {loading ? <>Analyzing <i /></> : <>Analyze MRI <span>→</span></>}
            </button>
            {error && <div className="error">{error}</div>}
          </div>

          <div className="card result">
            <div className="heading"><span>02</span><div><h2>AI Result</h2><p>Prediction generated from your MRI</p></div>{result && <label>RESULT READY</label>}</div>
            {!result && !loading && <div className="empty"><b>◌</b><h3>Your result will appear here</h3><p>Upload an MRI and click Analyze MRI to start inference.</p></div>}
            {loading && <div className="empty"><i className="loader" /><h3>Analyzing scan...</h3><p>Preprocessing image and extracting visual features.</p></div>}
            {result && <div>
              <div className="prediction"><b>✦</b><div><small>Predicted class</small><h3>{label(result.prediction)}</h3></div><aside><strong>{(result.confidence*100).toFixed(2)}%</strong><small>confidence</small></aside></div>
              <div className="probs"><div className="probs-title">Class probabilities <small>MODEL OUTPUT</small></div>
                {classes.map(([key, name]) => {
                  const v = result.probabilities?.[key] || 0;
                  return <div className="prob" key={key}><span>{name}</span><div><i style={{width:`${v*100}%`}} /></div><strong>{(v*100).toFixed(2)}%</strong></div>
                })}
              </div>
              <div className="note">ⓘ <span>For educational/research use only. This AI result is not a medical diagnosis.</span></div>
              <button className="again" onClick={reset}>Analyze another MRI</button>
            </div>}
          </div>
        </section>

        <section className="how">
          <small className="eyebrow">UNDER THE HOOD</small>
          <h2>From image to prediction</h2>
          <div className="steps">
            {[
              ["01","Upload","Select the MRI scan"],["02","Preprocess","Resize to 224×224"],
              ["03","Extract","Visual feature extraction"],["04","Classify","Softmax returns 4 probabilities"]
            ].map(x => <div key={x[0]}><small>{x[0]}</small><b>{x[1]}</b><p>{x[2]}</p></div>)}
          </div>
        </section>
        <footer>CerebroSight · Deep Learning Prototype <span>Research / educational use only</span></footer>
      </main>
    </div>
  );
}

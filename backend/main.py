import tensorflow as tf
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import io

app = FastAPI()

# React frontend ko backend access karne dena
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained model
model = tf.keras.models.load_model(
    "efficientnet_brain_tumor_81.keras"
)

class_names = [
    "glioma",
    "meningioma",
    "notumor",
    "pituitary"
]


@app.get("/")
def home():
    return {"message": "Brain Tumor API is running"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    # Read uploaded image
    image_bytes = await file.read()

    # Convert image
    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    # Resize exactly like training
    image = image.resize((224, 224))

    # Convert to numpy
    image_array = np.array(image)

    # Normalize
    image_array = image_array / 255.0

    # Add batch dimension
    image_array = np.expand_dims(
        image_array,
        axis=0
    )

    # Model prediction
    predictions = model.predict(
        image_array,
        verbose=0
    )[0]

    # Highest probability class
    predicted_index = np.argmax(predictions)

    predicted_class = class_names[predicted_index]

    confidence = float(
        predictions[predicted_index]
    )

    # All class probabilities
    probabilities = {
        class_names[i]: float(predictions[i])
        for i in range(len(class_names))
    }

    return {
        "prediction": predicted_class,
        "confidence": confidence,
        "probabilities": probabilities
    }
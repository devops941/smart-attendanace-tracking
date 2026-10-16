"""
Face Utilities Module
Smart Attendance System

Functions for:
- Detecting faces and extracting mathematical embeddings (128-d or 512-d)
- Comparing two embeddings with Euclidean or Cosine distance
- Serializing/deserializing embeddings for SQLite database storage

Privacy Rule:
RAW PHOTOS ARE NEVER STORED IN THE DATABASE.
Only mathematical numerical arrays (embeddings) are saved after user consent.
"""

import json
import numpy as np

# Try importing face_recognition (default)
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False


def extract_face_embedding_from_bytes(image_bytes: bytes):
    """
    Extracts 128-d face embedding from in-memory image bytes.
    Zero disk storage ensures student privacy compliance.
    Returns:
        np.ndarray (shape: (128,)) or None if no face is detected.
    """
    if not FACE_RECOGNITION_AVAILABLE:
        raise ImportError(
            "face_recognition is not installed. Please install dependencies from requirements.txt."
        )

    import io
    import cv2
    image_stream = io.BytesIO(image_bytes)
    image = face_recognition.load_image_file(image_stream)

    # Downscale high-resolution mobile photos for instant faster face detection
    h, w = image.shape[:2]
    if max(h, w) > 1200:
        scale = 1200.0 / max(h, w)
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    encodings = face_recognition.face_encodings(image)

    # Fallback: if no face found, retry with 2x upsampling for distant/subtle faces
    if len(encodings) == 0:
        locations = face_recognition.face_locations(image, number_of_times_to_upsample=2)
        if len(locations) > 0:
            encodings = face_recognition.face_encodings(image, known_face_locations=locations)

    if len(encodings) == 0:
        return None

    return encodings[0]


def extract_face_embedding_from_file(image_path: str):
    """
    Extracts 128-d face embedding from an image file path.
    Returns:
        np.ndarray (shape: (128,)) or None if no face is detected.
    """
    if not FACE_RECOGNITION_AVAILABLE:
        raise ImportError(
            "face_recognition is not installed. Please install dependencies from requirements.txt."
        )

    # Load image file
    image = face_recognition.load_image_file(image_path)
    encodings = face_recognition.face_encodings(image)

    if len(encodings) == 0:
        return None

    # Return primary face embedding (128 float values)
    return encodings[0]


def compare_embeddings(embedding1: np.ndarray, embedding2: np.ndarray, tolerance: float = 0.6):
    """
    Compares two face embeddings using Euclidean distance.
    Returns:
        (is_match: bool, distance: float, similarity_score: float)
    """
    # Euclidean distance between two vectors: sqrt(sum((a - b)^2))
    distance = float(np.linalg.norm(embedding1 - embedding2))
    is_match = distance <= tolerance

    # Convert distance to a 0 - 100% intuitive similarity score
    # Lower distance = higher match confidence
    similarity_score = max(0.0, min(100.0, (1.0 - (distance / 0.8)) * 100.0))

    return is_match, distance, round(similarity_score, 2)


def serialize_embedding(embedding: np.ndarray) -> str:
    """
    Converts a numpy embedding array into a JSON string for SQLite storage.
    """
    return json.dumps(embedding.tolist())


def deserialize_embedding(serialized_str: str) -> np.ndarray:
    """
    Converts a stored JSON string back into a numpy embedding array.
    """
    return np.array(json.loads(serialized_str), dtype=np.float64)

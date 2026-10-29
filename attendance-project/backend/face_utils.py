# Ensure pkg_resources compatibility for face_recognition_models across all environments
import sys
import os
if 'pkg_resources' not in sys.modules:
    try:
        import pkg_resources
    except ImportError:
        import importlib.util
        class _PkgResourcesShim:
            @staticmethod
            def resource_filename(package_name, resource_name):
                try:
                    spec = importlib.util.find_spec(package_name)
                    if spec and spec.origin:
                        base = os.path.dirname(spec.origin)
                        return os.path.join(base, resource_name)
                except Exception:
                    pass
                return os.path.abspath(resource_name)
        sys.modules['pkg_resources'] = _PkgResourcesShim

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
import logging
import numpy as np

logger = logging.getLogger("face_utils")

# Import face_recognition or create high-performance direct dlib fallback
FACE_RECOGNITION_AVAILABLE = False
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    try:
        import sys
        import dlib
        import face_recognition_models
        from PIL import Image, ImageOps

        class _DirectDlibFaceEngine:
            """Pure dlib fallback that executes the exact 128-d ResNet pipeline without face_recognition package."""
            def __init__(self):
                self._detector = dlib.get_frontal_face_detector()
                self._sp = dlib.shape_predictor(face_recognition_models.pose_predictor_model_location())
                self._fe = dlib.face_recognition_model_v1(face_recognition_models.face_recognition_model_location())

            def face_locations(self, img, number_of_times_to_upsample=1):
                rects = self._detector(img, number_of_times_to_upsample)
                return [(r.top(), r.right(), r.bottom(), r.left()) for r in rects]

            def face_encodings(self, img, known_face_locations=None, num_jitters=1):
                if known_face_locations is None:
                    raw_locations = self._detector(img, 1)
                else:
                    raw_locations = [dlib.rectangle(loc[3], loc[0], loc[1], loc[2]) for loc in known_face_locations]
                landmarks = [self._sp(img, r) for r in raw_locations]
                return [np.array(self._fe.compute_face_descriptor(img, l, num_jitters), dtype=np.float64) for l in landmarks]

            def load_image_file(self, file_path_or_stream):
                im = Image.open(file_path_or_stream)
                im = ImageOps.exif_transpose(im)
                return np.array(im.convert("RGB"))

        face_recognition = _DirectDlibFaceEngine()
        sys.modules['face_recognition'] = face_recognition
        FACE_RECOGNITION_AVAILABLE = True
    except Exception as _e:
        logger.warning(f"Biometric face engine unavailable: {_e}")
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
    import numpy as np
    from PIL import Image, ImageOps

    try:
        # Load image via PIL and auto-transpose according to EXIF metadata (essential for mobile selfies)
        pil_img = Image.open(io.BytesIO(image_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)
        image = np.array(pil_img.convert("RGB"))
    except Exception as e:
        logger.warning(f"PIL EXIF decode fallback to cv2: {e}")
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if bgr is None:
                image_stream = io.BytesIO(image_bytes)
                image = face_recognition.load_image_file(image_stream)
            else:
                image = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        except Exception as e2:
            logger.warning(f"Could not decode image bytes: {e2}")
            return None

    # Downscale high-resolution mobile photos for faster face detection
    h, w = image.shape[:2]
    if max(h, w) > 1000:
        scale = 1000.0 / max(h, w)
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


def compare_embeddings(embedding1: np.ndarray, embedding2: np.ndarray, tolerance: float = 0.48):
    """
    Compares two face embeddings using Euclidean distance.
    Default tolerance 0.48 ensures high biometric security and rejects proxy faces of other people.
    Returns:
        (is_match: bool, distance: float, similarity_score: float)
    """
    # Euclidean distance between two vectors: sqrt(sum((a - b)^2))
    distance = float(np.linalg.norm(embedding1 - embedding2))
    is_match = distance <= tolerance

    # Convert distance to a 0 - 100% intuitive similarity score
    # Lower distance = higher match confidence
    similarity_score = max(0.0, min(100.0, (1.0 - (distance / 0.8)) * 100.0))

    # High-security guard: Must be both within tolerance and confidence threshold
    is_match = is_match and (similarity_score >= 40.0)

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

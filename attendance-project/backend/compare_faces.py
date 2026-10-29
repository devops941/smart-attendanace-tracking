"""
Phase 1: Face Comparison Script
Smart Attendance App with Face Recognition and GPS

Goal:
Compare two facial photos and determine if they belong to the same person.

Key Concept:
We convert raw face images into a 128-dimensional "face embedding" (a mathematical fingerprint).
We NEVER store the actual photo file. For student privacy and security, we only ever
store and compare mathematical vectors (embeddings), with student consent.
"""

import sys
import os
import numpy as np

try:
    import face_recognition
except ImportError:
    try:
        import dlib
        import face_recognition_models
        from PIL import Image, ImageOps

        class _DirectDlibFaceEngine:
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
    except Exception as _e:
        print(f"\n[ERROR] Facial biometrics library error: {_e}\n")
        sys.exit(1)


def get_face_embedding(image_path: str):
    """
    Loads an image, detects the face, and returns its 128-dimensional embedding vector.
    
    Returns:
        numpy.ndarray: 128-d vector if exactly one face is found, else None.
    """
    if not os.path.exists(image_path):
        print(f"[Error] Image file not found: {image_path}")
        return None

    # Load image file into a numpy array (RGB format)
    image = face_recognition.load_image_file(image_path)

    # Detect all faces in the image and compute their embeddings
    # Each embedding is an array of 128 floating-point numbers
    face_encodings = face_recognition.face_encodings(image)

    # Edge Case 1: No face found
    if len(face_encodings) == 0:
        print(f"[Warning] No face detected in '{image_path}'. Ensure proper lighting and a clear frontal view.")
        return None

    # Edge Case 2: More than one face found
    if len(face_encodings) > 1:
        print(f"[Notice] Multiple faces detected ({len(face_encodings)}) in '{image_path}'. Using the primary face.")

    # Return the 128-dimensional embedding vector of the first face
    return face_encodings[0]


def compare_two_faces(image_path_1: str, image_path_2: str, tolerance: float = 0.48):
    """
    Compares two face photos using their mathematical embeddings.
    
    Args:
        image_path_1: Path to enrolled/reference photo.
        image_path_2: Path to live/verification photo.
        tolerance: Distance threshold (default 0.48 for strict biometric security).
                   Lower value (<= 0.48) prevents proxy attendance by other people.
                   Higher value (>= 0.60) is overly lenient and allows false positives.
    """
    print("=" * 60)
    print(" SMART ATTENDANCE - FACE COMPARISON VERIFICATION ")
    print("=" * 60)
    print(f"Photo 1 (Enrolled Face) : {image_path_1}")
    print(f"Photo 2 (Live Selfie)   : {image_path_2}")
    print("-" * 60)

    # Step 1: Extract 128-d embeddings
    print("Extracting facial embeddings (128-dimensional vectors)...")
    embedding_1 = get_face_embedding(image_path_1)
    embedding_2 = get_face_embedding(image_path_2)

    if embedding_1 is None or embedding_2 is None:
        print("\n[Result] COMPARISON FAILED: Could not extract face embeddings from both photos.")
        return False

    # Privacy Check: Demonstrate that embeddings are just numbers
    print(f"[Privacy Safe] Generated vector with {len(embedding_1)} numerical features.")
    print(f"Sample values (first 5 dimensions): {np.round(embedding_1[:5], 4)}")

    # Step 2: Compute Euclidean distance between the two vectors
    # Distance = 0.0 means identical faces. Distance > 0.6 usually means different people.
    distance = face_recognition.face_distance([embedding_1], embedding_2)[0]

    # Convert distance to a readable percentage similarity score
    # 0.0 distance -> 100% match, 0.6 distance -> ~50% match, >1.0 distance -> ~0% match
    similarity_percentage = max(0.0, min(100.0, (1.0 - (distance / 0.8)) * 100))

    # Step 3: Determine match based on tolerance threshold
    is_match = distance <= tolerance

    print("-" * 60)
    print(f"Face Euclidean Distance : {distance:.4f} (Threshold: <= {tolerance})")
    print(f"Estimated Match Score   : {similarity_percentage:.1f}%")
    print("-" * 60)

    if is_match:
        print("[SUCCESS] MATCH CONFIRMED: Photos belong to the SAME person!")
        print("Attendance Verification Status: FACE CHECK PASSED.")
    else:
        print("[REJECTED] NO MATCH: Photos appear to be of DIFFERENT persons.")
        print("Attendance Verification Status: FACE CHECK REJECTED.")

    print("=" * 60)
    return is_match


if __name__ == "__main__":
    # If paths are provided via command line:
    # Example: python compare_faces.py student1.jpg selfie.jpg
    if len(sys.argv) == 3:
        img1 = sys.argv[1]
        img2 = sys.argv[2]
        compare_two_faces(img1, img2)
    else:
        print("\nUsage:")
        print("  python compare_faces.py <path_to_photo1> <path_to_photo2>")
        print("\nExample:")
        print("  python compare_faces.py test_images/person1_enroll.jpg test_images/person1_live.jpg\n")

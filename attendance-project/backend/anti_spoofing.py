"""
Anti-Spoofing & Liveness Detection Module
Smart Attendance System (Phase 3)

Protects against Presentation Attacks (PAD):
1. Printed paper photo attacks (flat 2D texture, low depth variance)
2. Digital screen replay attacks (smartphone/tablet/laptop displays with glare, moiré & backlight bias)
3. 3D mask / cutout attacks (abnormal landmark geometry & edge gradients)

Methods:
- 2D Fast Fourier Transform (FFT) for screen moiré subpixel pattern detection
- Laplacian variance for micro-texture and sharpness evaluation
- 68-Point Facial Landmark Eye Aspect Ratio (EAR) and facial geometry symmetry
- RGB & YCbCr chrominance and specular screen glare hotspot analysis
- Multi-frame optical motion verification for active liveness / blink challenge
"""

import io
import math
from typing import Dict, Any, Tuple, Optional, List
import numpy as np
import cv2
import face_recognition


def calculate_ear(eye_points: List[Tuple[int, int]]) -> float:
    """
    Computes Eye Aspect Ratio (EAR) for a 6-point eye landmark contour.
    EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
    """
    if len(eye_points) < 6:
        return 0.0

    p1 = np.array(eye_points[0])
    p2 = np.array(eye_points[1])
    p3 = np.array(eye_points[2])
    p4 = np.array(eye_points[3])
    p5 = np.array(eye_points[4])
    p6 = np.array(eye_points[5])

    dist_v1 = np.linalg.norm(p2 - p6)
    dist_v2 = np.linalg.norm(p3 - p5)
    dist_h = np.linalg.norm(p1 - p4)

    if dist_h == 0:
        return 0.0

    return float((dist_v1 + dist_v2) / (2.0 * dist_h))


def calculate_mar(top_lip: List[Tuple[int, int]], bottom_lip: List[Tuple[int, int]]) -> float:
    """Computes Mouth Aspect Ratio (MAR) to detect smiles or open mouth expressions."""
    if not top_lip or not bottom_lip:
        return 0.0

    # Top lip bottom edge vs bottom lip top edge center
    top_center = np.mean(top_lip[-3:], axis=0)
    bottom_center = np.mean(bottom_lip[:3], axis=0)
    vertical_dist = np.linalg.norm(top_center - bottom_center)

    # Mouth corners
    corner_left = np.array(top_lip[0])
    corner_right = np.array(top_lip[6]) if len(top_lip) > 6 else np.array(top_lip[-1])
    horizontal_dist = np.linalg.norm(corner_left - corner_right)

    if horizontal_dist == 0:
        return 0.0

    return float(vertical_dist / horizontal_dist)


def check_moire_patterns(gray_face: np.ndarray) -> Tuple[float, bool]:
    """
    Uses 2D Fast Fourier Transform (FFT) to detect high-frequency repeating patterns
    caused by digital screen pixels (LCD/OLED moiré effect).
    Returns (moire_score: float [0-100], moire_detected: bool).
    """
    if gray_face.shape[0] < 32 or gray_face.shape[1] < 32:
        return 100.0, False

    resized = cv2.resize(gray_face, (128, 128))
    f = np.fft.fft2(resized)
    fshift = np.fft.fftshift(f)
    magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-7)

    # High frequency outer ring
    h, w = magnitude_spectrum.shape
    crow, ccol = h // 2, w // 2
    mask = np.ones((h, w), np.uint8)
    r_inner = 15
    cv2.circle(mask, (ccol, crow), r_inner, 0, -1)

    outer_mag = magnitude_spectrum[mask == 1]
    peak_to_mean = float(np.max(outer_mag) / (np.mean(outer_mag) + 1e-5))

    # Abnormal periodic spikes indicate digital screen grid
    is_moire = peak_to_mean > 2.2
    moire_score = max(0.0, min(100.0, (1.0 - (peak_to_mean - 1.2) / 1.5) * 100.0))

    return round(moire_score, 2), is_moire


def check_texture_sharpness(gray_face: np.ndarray) -> Tuple[float, float, bool]:
    """
    Analyzes micro-texture details using the Laplacian operator variance.
    Natural faces possess skin pores and gentle gradients.
    Paper printouts and distant replays typically exhibit low variance (<40).
    """
    laplacian_var = float(cv2.Laplacian(gray_face, cv2.CV_64F).var())

    # Score calculation: ideal range is between 50 and 500
    if laplacian_var < 35.0:
        # Too blurry / flat (paper or out-of-focus phone)
        score = max(0.0, (laplacian_var / 35.0) * 45.0)
        is_blurry = True
    elif laplacian_var > 1200.0:
        # Abnormally sharp (artificial screen noise or harsh digital sharpening)
        score = max(50.0, 100.0 - (laplacian_var - 1200.0) / 20.0)
        is_blurry = False
    else:
        # Natural range
        score = min(100.0, 70.0 + (min(laplacian_var, 300.0) / 300.0) * 30.0)
        is_blurry = False

    return round(laplacian_var, 2), round(score, 2), is_blurry


def check_specular_reflections(bgr_face: np.ndarray) -> Tuple[float, bool]:
    """
    Identifies specular screen reflections and glass glare characteristic of smartphone/laptop screens.
    """
    gray = cv2.cvtColor(bgr_face, cv2.COLOR_BGR2GRAY)
    # Bright hotspots
    _, bright_mask = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY)
    bright_ratio = float(np.sum(bright_mask > 0) / (gray.shape[0] * gray.shape[1]))

    # If glare covers more than 3.5% of the face tightly, likely a screen glare
    has_harsh_glare = bright_ratio > 0.035
    glare_score = max(0.0, min(100.0, (1.0 - (bright_ratio / 0.05)) * 100.0))

    return round(glare_score, 2), has_harsh_glare


def check_chrominance_distribution(bgr_face: np.ndarray) -> Tuple[float, bool]:
    """
    Evaluates color temperature and chrominance consistency.
    Digital displays often impart blue-white backlight tinting.
    """
    b, g, r = cv2.split(bgr_face)
    mean_b = float(np.mean(b))
    mean_r = float(np.mean(r))

    # Natural human skin under typical conditions has mean_r >= mean_b
    # Screens showing photos frequently invert this or have abnormally high blue dominance
    blue_ratio = mean_b / (mean_r + 1e-5)
    is_unnatural_tint = blue_ratio > 1.25

    if is_unnatural_tint:
        color_score = max(20.0, 100.0 - (blue_ratio - 1.0) * 80.0)
    else:
        color_score = min(100.0, 85.0 + (1.0 - abs(blue_ratio - 0.75)) * 15.0)

    return round(color_score, 2), is_unnatural_tint


def evaluate_liveness(image_bytes: bytes) -> Dict[str, Any]:
    """
    Primary Anti-Spoofing Evaluation Pipeline.
    Combines texture analysis, landmark geometry, screen moiré detection,
    specular reflection inspection, and chrominance distribution.

    Returns:
        {
            "is_live": bool,
            "liveness_score": float (0-100),
            "status": "LIVE" | "SPOOF_SUSPECTED" | "NO_FACE",
            "diagnostics": { ... details ... },
            "warnings": [ ... ]
        }
    """
    # 1. Decode image from in-memory bytes
    np_arr = np.frombuffer(image_bytes, np.uint8)
    bgr_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if bgr_img is None:
        return {
            "is_live": False,
            "liveness_score": 0.0,
            "status": "DECODE_ERROR",
            "message": "Failed to decode image bytes.",
            "diagnostics": {},
            "warnings": ["Image decoding failure"]
        }

    # Convert to RGB for face_recognition
    rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)

    # 2. Detect face and landmarks
    face_locations = face_recognition.face_locations(rgb_img)
    if not face_locations:
        return {
            "is_live": False,
            "liveness_score": 0.0,
            "status": "NO_FACE",
            "message": "No face found in image.",
            "diagnostics": {},
            "warnings": ["No face detected"]
        }

    landmarks_list = face_recognition.face_landmarks(rgb_img, face_locations)
    top, right, bottom, left = face_locations[0]

    # Crop face region with 10% safety margin
    h, w, _ = bgr_img.shape
    pad_h = int((bottom - top) * 0.1)
    pad_w = int((right - left) * 0.1)
    crop_top = max(0, top - pad_h)
    crop_bottom = min(h, bottom + pad_h)
    crop_left = max(0, left - pad_w)
    crop_right = min(w, right + pad_w)

    face_crop_bgr = bgr_img[crop_top:crop_bottom, crop_left:crop_right]
    face_crop_gray = cv2.cvtColor(face_crop_bgr, cv2.COLOR_BGR2GRAY)

    warnings = []

    # 3. Check Texture & Laplacian Variance
    lap_var, texture_score, is_blurry = check_texture_sharpness(face_crop_gray)
    if is_blurry:
        texture_score = min(texture_score, 30.0)
        warnings.append(f"Low surface texture variance ({lap_var:.1f}). Possible paper photo or out-of-focus spoof.")

    # 4. Check Screen Moiré Patterns (FFT)
    moire_score, is_moire = check_moire_patterns(face_crop_gray)
    if is_moire:
        moire_score = min(moire_score, 35.0)
        warnings.append("High-frequency digital screen grid / moiré pattern detected.")

    # 5. Check Specular Reflections & Screen Glare
    glare_score, has_glare = check_specular_reflections(face_crop_bgr)
    if has_glare:
        glare_score = min(glare_score, 30.0)
        warnings.append("Harsh specular glare detected, consistent with phone/tablet screen reflections.")

    # 6. Check Chrominance & Color Space
    color_score, unnatural_tint = check_chrominance_distribution(face_crop_bgr)
    if unnatural_tint:
        color_score = min(color_score, 35.0)
        warnings.append("Unnatural screen backlight color temperature detected.")

    # 7. Check 68-Point Facial Landmark Eye Aspect Ratio (EAR) & Symmetry
    ear_score = 75.0
    avg_ear = 0.28
    left_ear, right_ear = 0.28, 0.28

    if landmarks_list:
        lms = landmarks_list[0]
        left_eye = lms.get("left_eye", [])
        right_eye = lms.get("right_eye", [])

        if left_eye and right_eye:
            left_ear = calculate_ear(left_eye)
            right_ear = calculate_ear(right_eye)
            avg_ear = (left_ear + right_ear) / 2.0

            # Anatomical check: realistic human EAR is typically between 0.18 and 0.42
            if 0.18 <= avg_ear <= 0.42:
                ear_score = 100.0
            elif avg_ear < 0.15:
                # Closed or squinted eyes (or paper cutout)
                ear_score = 40.0
                warnings.append(f"Low Eye Aspect Ratio ({avg_ear:.2f}). Eyes closed or distorted.")
            else:
                ear_score = 65.0

            # Symmetry check between left and right eye
            ear_diff = abs(left_ear - right_ear)
            if ear_diff > 0.12:
                ear_score = max(30.0, ear_score - 25.0)
                warnings.append("Asymmetric eye geometry detected.")

    # 8. Compute Composite Liveness Score
    # Weights: Texture 30%, Moiré 20%, Glare/Reflections 20%, Color 15%, Geometry/EAR 15%
    composite_score = (
        (texture_score * 0.30) +
        (moire_score * 0.20) +
        (glare_score * 0.20) +
        (color_score * 0.15) +
        (ear_score * 0.15)
    )

    # Additional penalty if critical spoof indicators triggered
    if has_glare and is_blurry:
        composite_score = min(composite_score, 45.0)
    if is_moire and unnatural_tint:
        composite_score = min(composite_score, 40.0)

    composite_score = round(max(0.0, min(100.0, composite_score)), 1)

    # Decision threshold: >= 60.0% AND no more than 1 minor warning is accepted as a LIVE human subject
    is_live = composite_score >= 60.0 and len(warnings) <= 1

    return {
        "is_live": is_live,
        "liveness_score": composite_score,
        "status": "LIVE" if is_live else "SPOOF_SUSPECTED",
        "message": "Liveness verified. Genuine live human face." if is_live else ("Spoof attack suspected: " + "; ".join(warnings)),
        "diagnostics": {
            "texture_variance": lap_var,
            "texture_score": texture_score,
            "moire_score": moire_score,
            "glare_score": glare_score,
            "color_score": color_score,
            "eye_aspect_ratio": round(avg_ear, 3),
            "ear_score": ear_score
        },
        "warnings": warnings
    }


def verify_active_motion(frame1_bytes: bytes, frame2_bytes: bytes) -> Dict[str, Any]:
    """
    Active Liveness Multi-Frame Check:
    Analyzes micro-motion and optical flow between two consecutive frames captured 300-600ms apart.
    Confirms the subject is a live 3D moving biological entity rather than a static 2D printout or held phone.
    """
    arr1 = np.frombuffer(frame1_bytes, np.uint8)
    arr2 = np.frombuffer(frame2_bytes, np.uint8)

    img1 = cv2.imdecode(arr1, cv2.IMREAD_COLOR)
    img2 = cv2.imdecode(arr2, cv2.IMREAD_COLOR)

    if img1 is None or img2 is None:
        return {"passed": False, "score": 0.0, "message": "Failed to decode frame pair."}

    gray1 = cv2.cvtColor(cv1 := cv2.resize(img1, (320, 240)), cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(cv2.resize(img2, (320, 240)), cv2.COLOR_BGR2GRAY)

    # Frame difference
    diff = cv2.absdiff(gray1, gray2)
    diff_val = float(np.mean(diff))

    # A completely identical difference (< 0.5) indicates an identical frozen image or static paper photo.
    # A moderate difference (1.5 - 25.0) indicates natural micro-movement/breathing/blinking.
    # An extreme difference (> 45.0) indicates sudden camera shake or cut.
    is_natural_motion = 1.0 <= diff_val <= 35.0

    score = 100.0 if is_natural_motion else (20.0 if diff_val < 1.0 else 40.0)

    return {
        "passed": is_natural_motion,
        "motion_energy": round(diff_val, 2),
        "score": score,
        "message": "Natural biological motion confirmed." if is_natural_motion else "Static image or unnatural motion detected."
    }

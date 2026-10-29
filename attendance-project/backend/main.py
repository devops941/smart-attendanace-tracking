"""
FastAPI Backend Application
Smart Attendance System with 128-d Face Recognition and GPS Geofencing

Core Features:
- Biometric verification via mathematical face embeddings (zero raw photo storage)
- GPS classroom geofencing via Haversine distance formula
- Device ID binding for anti-proxy attendance prevention
- Real-time audit logging and interactive web dashboard
"""

import io
import os
import csv
from datetime import datetime
from typing import Optional, List
import numpy as np

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from pydantic import BaseModel

import database
import geo_utils
import face_utils
import anti_spoofing

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEST_IMAGES_DIR = os.path.join(BASE_DIR, "test_images")

# Initialize FastAPI application
app = FastAPI(
    title="Smart Attendance Verification API",
    description="Multi-factor attendance validation powered by Facial Biometrics, GPS Geofencing, and Anti-Proxy Device Binding.",
    version="1.0.0"
)

# CORS Middleware (permits local web browsers and Flutter mobile app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Initializes SQLite database tables and seeds initial campus zones on launch."""
    database.init_db()


# ==========================================
# Pydantic Schemas
# ==========================================

class ZoneCreateRequest(BaseModel):
    name: str
    latitude: float
    longitude: float
    radius_meters: float = 50.0


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class StudentLoginRequest(BaseModel):
    student_id: str
    password: str
    device_id: Optional[str] = None


class EmployeeLoginRequest(BaseModel):
    emp_code: str
    password: str
    device_id: Optional[str] = None


class BranchCreateRequest(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    radius_meters: float = 100.0
    office_wifi_bssid: Optional[str] = None
    office_public_ip: Optional[str] = None


class BreakRequest(BaseModel):
    emp_code: str
    break_type: Optional[str] = "LUNCH"


# ==========================================
# Frontend & Authentication Endpoints
# ==========================================

@app.post("/api/admin/login")
@app.post("/api/faculty/login")
def admin_login(creds: AdminLoginRequest):
    """Authenticates faculty/admin and generates access token for role-based access."""
    admin = database.verify_admin(creds.username, creds.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid administrator username or password. (Default: admin / admin123)")
    token = f"admin_token_{admin['username']}_{database.get_now_ist().strftime('%Y%m%d%H%M%S')}"
    admin_info = {
        "id": admin.get("id", 1),
        "username": admin["username"],
        "name": admin.get("full_name") or admin["username"],
        "full_name": admin.get("full_name") or admin["username"],
        "role": admin.get("role", "admin")
    }
    return {
        "success": True,
        "token": token,
        "admin": admin_info,
        "user": admin_info
    }


@app.post("/api/student/login")
def student_login(creds: StudentLoginRequest):
    """Authenticates enrolled student using Student ID and password (default: student123)."""
    student = database.verify_student(creds.student_id, creds.password)
    if not student:
        raise HTTPException(
            status_code=401,
            detail="Invalid Student ID or password. (Default password: student123)"
        )
    if creds.device_id and creds.device_id.strip():
        database.update_student_device(student["student_id"], creds.device_id.strip())
        student["device_id"] = creds.device_id.strip()

    token = f"student_token_{student['student_id']}_{database.get_now_ist().strftime('%Y%m%d%H%M%S')}"
    return {
        "success": True,
        "token": token,
        "student": student
    }

@app.get("/", response_class=HTMLResponse)
def get_dashboard():
    """Serves the interactive web verification dashboard."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return HTMLResponse("<h1>Smart Attendance API is running. static/index.html not found.</h1>")


@app.get("/api/health")
def health_check():
    """System health inspection endpoint."""
    return {
        "status": "online",
        "timestamp": database.get_now_ist().isoformat(),
        "timezone": "IST (UTC+05:30)",
        "face_engine_ready": face_utils.FACE_RECOGNITION_AVAILABLE,
        "database": "sqlite_ready"
    }


@app.get("/api/stats")
def get_system_stats():
    """Returns real-time metrics for dashboard cards."""
    return database.get_stats()


# Test image helper routes for browser simulator
@app.get("/api/test-image/student_enroll")
def get_test_enroll_photo():
    img_path = os.path.join(TEST_IMAGES_DIR, "student_enroll.jpg")
    if os.path.exists(img_path):
        return FileResponse(img_path, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Sample enroll photo not found")


@app.get("/api/test-image/student_selfie")
def get_test_selfie_photo():
    img_path = os.path.join(TEST_IMAGES_DIR, "student_selfie.jpg")
    if os.path.exists(img_path):
        return FileResponse(img_path, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Sample selfie photo not found")


# ==========================================
# Student Enrollment Endpoints
# ==========================================

@app.post("/api/students/register")
async def register_student(
    student_id: str = Form(...),
    name: str = Form(...),
    email: Optional[str] = Form(None),
    device_id: str = Form(...),
    password: Optional[str] = Form("student123"),
    photo: UploadFile = File(...)
):
    """
    Enrolls a student:
    1. Reads uploaded photo in-memory
    2. Extracts 128-d face embedding vector
    3. Serializes vector and saves to database alongside bound device_id and password
    4. Discards the raw image bytes immediately (Zero raw photo storage privacy policy)
    """
    photo_bytes = await photo.read()
    if not photo_bytes:
        raise HTTPException(status_code=400, detail="Uploaded photo is empty.")

    try:
        embedding = face_utils.extract_face_embedding_from_bytes(photo_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Biometric processing error: {str(e)}")

    if embedding is None:
        raise HTTPException(
            status_code=400,
            detail="No face could be detected in the uploaded photo. Please ensure a clear, well-lit, frontal portrait."
        )

    # Convert embedding to JSON string
    serialized_embedding = face_utils.serialize_embedding(embedding)

    # Save to SQLite database
    database.add_student(
        student_id=student_id,
        name=name,
        email=email,
        device_id=device_id,
        face_embedding_json=serialized_embedding,
        password=password
    )

    return {
        "success": True,
        "message": f"Student '{name}' registered successfully with 128-d biometric signature.",
        "student": {
            "student_id": student_id,
            "name": name,
            "email": email,
            "device_id": device_id
        },
        "biometric_details": {
            "dimensions": len(embedding),
            "vector_sample": [round(float(x), 4) for x in embedding[:5]]
        }
    }


@app.get("/api/students")
def get_all_students():
    """Lists all enrolled students."""
    return database.list_students()


@app.delete("/api/students/{student_id}")
def delete_student(student_id: str):
    """Deletes a student record."""
    deleted = database.delete_student(student_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Student not found.")
    return {"success": True, "message": f"Student '{student_id}' removed."}


# ==========================================
# Geofence Zones Endpoints
# ==========================================

@app.get("/api/zones")
def get_zones(only_active: bool = False):
    """Lists classroom geofence zones."""
    return database.get_zones(only_active=only_active)


@app.post("/api/zones")
def create_zone(zone: ZoneCreateRequest):
    """Adds a new classroom geofence zone."""
    zone_id = database.add_zone(
        name=zone.name,
        latitude=zone.latitude,
        longitude=zone.longitude,
        radius_meters=zone.radius_meters
    )
    return {"success": True, "id": zone_id, "message": f"Zone '{zone.name}' created."}


@app.delete("/api/zones/{zone_id}")
def remove_zone(zone_id: int):
    """Deletes a classroom geofence zone."""
    deleted = database.delete_zone(zone_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Zone not found.")
    return {"success": True, "message": f"Zone {zone_id} deleted."}


# ==========================================
# Hourly Timetable & Day-Wise History Endpoints
# ==========================================

class SimulateTimeRequest(BaseModel):
    time_str: Optional[str] = None  # e.g. "09:45" for >30m late lockout, "09:05" for on-time, None to reset


@app.get("/api/schedule/current")
def get_current_schedule(student_id: Optional[str] = Query(None)):
    """Returns current active class period, countdowns, and window state (On-Time, Late, Locked Out, Lunch Break)."""
    info = database.get_current_schedule_info(student_id=student_id)
    info["simulated_time"] = database.get_global_simulated_time()
    return info


@app.post("/api/schedule/simulate-time")
def simulate_schedule_time(req: SimulateTimeRequest):
    """Sets a simulated clock time for easy classroom testing (e.g. '09:45' for >30m lockout)."""
    database.set_global_simulated_time(req.time_str)
    info = database.get_current_schedule_info()
    return {
        "success": True,
        "simulated_time": database.get_global_simulated_time(),
        "window_status": info.get("window_status"),
        "message": info.get("message")
    }


@app.get("/api/schedule/periods")
def get_all_periods():
    """Returns full 8-hour college schedule (Period 1 to 7 + Lunch Break)."""
    return database.get_all_periods()


@app.get("/api/attendance/student-day-history")
def get_student_day_history_api(
    student_id: str = Query(...),
    date: Optional[str] = Query(None)
):
    """Returns day-by-day attendance scoreboard and period breakdown for a student."""
    return database.get_student_day_history(student_id=student_id, date_str=date)


# ==========================================
# Core Attendance Verification Endpoint
# ==========================================

@app.post("/api/attendance/check-in")
async def check_in_attendance(
    student_id: str = Form(...),
    device_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    selfie: UploadFile = File(...)
):
    """
    Multi-Factor Attendance Verification Pipeline:
    Factor 0: 8-Hour Timetable Schedule & 30-Minute Grace/Lockout Window
    Factor 1: Student Existence & Device ID Binding (Anti-Proxy)
    Factor 2: GPS Geofence Proximity (Haversine formula against active classroom zones)
    Factor 3: Facial Biometrics (Euclidean distance comparison with enrolled 128-d vector)
    Factor 4: Presentation Attack Detection (Liveness / Anti-spoofing)
    """
    # 0. Schedule & Timetable Verification (Real-time IST schedule tracking)
    sched = database.get_current_schedule_info(student_id=student_id)
    cur_p = sched.get("current_period") or {}
    period_id = cur_p.get("id") or 1
    period_name = cur_p.get("name") or "Period 1"
    arrival_status = sched.get("arrival_status", "ON_TIME")
    minutes_late = sched.get("minutes_late", 0)

    if sched.get("can_check_in") is False:
        raise HTTPException(
            status_code=403,
            detail=sched.get("message") or f"Check-in locked out for {period_name}."
        )

    # 1. Lookup student
    student = database.get_student(student_id)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' is not enrolled.")

    student_name = student["name"]
    registered_device = student["device_id"]
    enrolled_embedding_str = student["face_embedding"]

    # 2. Factor 1: Device Binding Check
    device_verified = (device_id.strip() == registered_device.strip())

    # 3. Factor 2: GPS Geofence Check (with 150m indoor drift tolerance)
    active_zones = database.get_zones(only_active=True)
    nearest_zone, distance_to_zone, location_verified = geo_utils.find_nearest_zone(
        latitude, longitude, active_zones, drift_tolerance_meters=150.0
    )

    zone_id = nearest_zone["id"] if nearest_zone else None
    zone_name = nearest_zone["name"] if nearest_zone else "Corporate Office Branch"
    radius_meters = nearest_zone["radius_meters"] if nearest_zone else 100.0

    # If no zones exist yet, default to verified
    if not active_zones:
        location_verified = True

    # 4. Factor 3: Facial Biometric Verification
    selfie_bytes = await selfie.read()
    if not selfie_bytes:
        raise HTTPException(status_code=400, detail="Captured selfie photo is empty.")

    live_embedding = face_utils.extract_face_embedding_from_bytes(selfie_bytes)

    face_verified = False
    face_distance = None
    similarity_score = 0.0
    vector_sample = None

    if live_embedding is not None:
        vector_sample = [round(float(x), 4) for x in live_embedding[:5]]
        enrolled_embedding = face_utils.deserialize_embedding(enrolled_embedding_str)
        face_verified, face_distance, similarity_score = face_utils.compare_embeddings(
            live_embedding, enrolled_embedding, tolerance=0.48
        )

    # 5. Factor 4: Anti-Spoofing & Liveness Detection (PAD Protection)
    liveness_eval = anti_spoofing.evaluate_liveness(selfie_bytes)
    liveness_verified = liveness_eval["is_live"]
    liveness_score = liveness_eval["liveness_score"]

    # Bind device if first-time check-in without a registered device
    if face_verified and liveness_verified:
        if not registered_device:
            database.update_student_device(student_id, device_id.strip())
            registered_device = device_id.strip()
            device_verified = True

    # 6. Determine Decision & Diagnoses
    fail_reasons = []
    if not device_verified:
        fail_reasons.append(f"Device mismatch (registered '{registered_device}', got '{device_id}')")
    if not location_verified:
        fail_reasons.append(f"Outside office boundary ({distance_to_zone:.1f}m from '{zone_name}', allowed: {radius_meters}m + 150m drift)")
    if live_embedding is None:
        fail_reasons.append("No face detected in selfie photo. Please align your face inside the circle.")
    elif not face_verified:
        fail_reasons.append(f"Biometric mismatch (Distance: {face_distance:.4f} > 0.60, match score: {similarity_score}%)")
    if not liveness_verified:
        fail_reasons.append(f"Spoof detected (Liveness: {liveness_score}%, {liveness_eval['message']})")

    all_passed = device_verified and location_verified and face_verified and liveness_verified

    if all_passed:
        status = "SUCCESS"
        arrival_note = f" (Arrival: {arrival_status}" + (f", {minutes_late}m late)" if minutes_late > 0 else ")")
        audit_message = f"All checks passed for {period_name}! In '{zone_name}' ({distance_to_zone:.1f}m), Biometric confidence: {similarity_score}%{arrival_note}."
    else:
        if len(fail_reasons) > 1:
            status = "REJECTED_MULTIPLE"
        elif not liveness_verified:
            status = "REJECTED_SPOOF"
        elif not device_verified:
            status = "REJECTED_DEVICE"
        elif not location_verified:
            status = "REJECTED_LOCATION"
        elif live_embedding is None:
            status = "REJECTED_NO_FACE"
        else:
            status = "REJECTED_FACE"

        audit_message = "Rejected: " + "; ".join(fail_reasons)

    # 7. Save audit log record into database
    record_id = database.log_attendance(
        student_id=student_id,
        student_name=student_name,
        device_id=device_id,
        device_verified=device_verified,
        user_latitude=latitude,
        user_longitude=longitude,
        zone_id=zone_id,
        zone_name=zone_name,
        distance_to_zone_meters=distance_to_zone if distance_to_zone != float("inf") else None,
        location_verified=location_verified,
        face_distance=round(face_distance, 4) if face_distance is not None else None,
        face_similarity_score=similarity_score,
        face_verified=face_verified,
        liveness_score=liveness_score,
        liveness_verified=liveness_verified,
        status=status,
        message=audit_message,
        attendance_date=sched.get("today_date", database.get_now_ist().strftime("%Y-%m-%d")),
        period_id=period_id,
        period_name=period_name,
        arrival_status=arrival_status,
        minutes_late=minutes_late
    )

    # 8. Return detailed response
    return {
        "success": all_passed,
        "status": status,
        "message": audit_message,
        "record_id": record_id,
        "student": {
            "student_id": student_id,
            "name": student_name
        },
        "period": {
            "period_id": period_id,
            "period_name": period_name,
            "arrival_status": arrival_status,
            "minutes_late": minutes_late,
            "time_window": f"{cur_p.get('start_time', '')} - {cur_p.get('end_time', '')}"
        },
        "checks": {
            "device": {
                "passed": device_verified,
                "registered_device": registered_device,
                "provided_device": device_id
            },
            "location": {
                "passed": location_verified,
                "zone_name": zone_name,
                "distance_meters": round(distance_to_zone, 1) if distance_to_zone != float("inf") else None,
                "radius_meters": radius_meters
            },
            "face": {
                "passed": face_verified,
                "face_detected": live_embedding is not None,
                "distance": round(face_distance, 4) if face_distance is not None else None,
                "similarity_score": similarity_score,
                "threshold": 0.60,
                "vector_sample": vector_sample
            },
            "liveness": {
                "passed": liveness_verified,
                "score": liveness_score,
                "status": liveness_eval["status"],
                "message": liveness_eval["message"],
                "diagnostics": liveness_eval.get("diagnostics", {}),
                "warnings": liveness_eval.get("warnings", [])
            }
        },
        "timestamp": database.get_now_ist().strftime("%Y-%m-%d %H:%M:%S")
    }


# ==========================================
# Standalone Anti-Spoofing Inspection API
# ==========================================

@app.post("/api/liveness/evaluate")
async def evaluate_photo_liveness(photo: UploadFile = File(...)):
    """Evaluates liveness and Presentation Attack Detection (PAD) on an uploaded image."""
    photo_bytes = await photo.read()
    if not photo_bytes:
        raise HTTPException(status_code=400, detail="Empty photo uploaded.")
    return anti_spoofing.evaluate_liveness(photo_bytes)


# ==========================================
# Attendance Records & CSV Export
# ==========================================

@app.get("/api/attendance/records")
def get_attendance_records(
    student_id: Optional[str] = Query(None),
    status: Optional[str] = Query("ALL"),
    limit: int = Query(50, ge=1, le=500)
):
    """Fetches attendance audit history with optional filters."""
    return database.get_attendance_records(student_id=student_id, status=status, limit=limit)


@app.get("/api/attendance/export-csv")
def export_attendance_csv():
    """Generates and downloads a CSV spreadsheet of all attendance records."""
    records = database.get_attendance_records(limit=1000)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Record ID", "Timestamp", "Student ID", "Student Name",
        "Status", "Device ID", "Device Verified",
        "Latitude", "Longitude", "Zone Name", "Distance (m)", "Location Verified",
        "Face Distance", "Similarity Score (%)", "Face Verified",
        "Liveness Score (%)", "Liveness Verified", "Message"
    ])

    for r in records:
        writer.writerow([
            r["id"], r["timestamp"], r["student_id"], r["student_name"],
            r["status"], r["device_id"], "Yes" if r["device_verified"] else "No",
            r["user_latitude"], r["user_longitude"], r["zone_name"], r["distance_to_zone_meters"], "Yes" if r["location_verified"] else "No",
            r["face_distance"], r["face_similarity_score"], "Yes" if r["face_verified"] else "No",
            r.get("liveness_score", 100.0), "Yes" if r.get("liveness_verified", 1) else "No",
            r["message"]
        ])

    output.seek(0)
    filename = f"attendance_export_{database.get_now_ist().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==========================================
# Corporate Office Employee Endpoints
# ==========================================

@app.post("/api/employee/login")
def employee_login(creds: EmployeeLoginRequest):
    """Authenticates corporate employee and binds hardware device ID."""
    emp = database.verify_employee(creds.emp_code, creds.password)
    if not emp:
        raise HTTPException(
            status_code=401,
            detail="Invalid Employee Code or password. (Default password: office123)"
        )
    if creds.device_id and creds.device_id.strip():
        database.update_employee_device(emp["emp_code"], creds.device_id.strip())
        emp["device_id"] = creds.device_id.strip()

    token = f"emp_token_{emp['emp_code']}_{database.get_now_ist().strftime('%Y%m%d%H%M%S')}"
    return {
        "success": True,
        "token": token,
        "employee": emp
    }


@app.get("/api/employee/status/{emp_code}")
def get_employee_status(emp_code: str):
    """Returns real-time daily work hours, in-office status, and break state."""
    return database.get_employee_daily_status(emp_code)


@app.post("/api/employee/register")
async def register_employee(
    emp_code: str = Form(...),
    name: str = Form(...),
    email: Optional[str] = Form(None),
    department: str = Form("Engineering"),
    designation: str = Form("Staff Member"),
    branch_id: int = Form(1),
    device_id: str = Form(...),
    password: Optional[str] = Form("office123"),
    photo: UploadFile = File(...)
):
    """Enrolls corporate employee with 128-d biometric embedding and device binding."""
    photo_bytes = await photo.read()
    if not photo_bytes:
        raise HTTPException(status_code=400, detail="Uploaded photo file is empty.")

    embedding = face_utils.extract_face_embedding_from_bytes(photo_bytes)
    if embedding is None:
        raise HTTPException(
            status_code=422,
            detail="No human face could be clearly identified. Please take a well-lit front-facing portrait."
        )

    serialized_embedding = face_utils.serialize_embedding(embedding)
    database.add_employee(
        emp_code=emp_code,
        name=name,
        email=email,
        department=department,
        designation=designation,
        branch_id=branch_id,
        device_id=device_id,
        face_embedding_json=serialized_embedding,
        password=password
    )

    return {
        "success": True,
        "message": f"Employee '{name}' ({emp_code}) enrolled successfully with 128-d biometric vector signature.",
        "employee": {
            "emp_code": emp_code,
            "name": name,
            "department": department,
            "designation": designation
        }
    }


@app.get("/api/employees")
def get_all_employees():
    """Lists all registered corporate employees."""
    return database.list_employees()


@app.get("/api/employees/{emp_code}")
def get_single_employee(emp_code: str):
    """Retrieves single employee profile."""
    emp = database.get_employee(emp_code)
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found.")
    emp.pop("face_embedding", None)
    emp.pop("password_hash", None)
    return emp


@app.put("/api/employees/{emp_code}")
@app.post("/api/employees/{emp_code}/update")
async def update_employee_profile(emp_code: str, request: Request):
    """Updates an employee profile, branch allocation, device binding, and optionally reference biometric vector."""
    existing = database.get_employee(emp_code)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Employee '{emp_code}' not found.")

    content_type = request.headers.get("content-type", "")
    name = None
    email = None
    department = None
    designation = None
    branch_id = None
    device_id = None
    password = None
    face_vector_json = None

    if "application/json" in content_type:
        data = await request.json()
        name = data.get("name")
        email = data.get("email")
        department = data.get("department")
        designation = data.get("designation")
        branch_id = data.get("branch_id")
        device_id = data.get("device_id")
        password = data.get("password")
    else:
        form = await request.form()
        name = form.get("name")
        email = form.get("email")
        department = form.get("department")
        designation = form.get("designation")
        branch_id = form.get("branch_id")
        device_id = form.get("device_id")
        password = form.get("password")
        photo = form.get("photo")
        if photo and hasattr(photo, "read") and getattr(photo, "filename", None):
            contents = await photo.read()
            if len(contents) > 0:
                emb, err = face_utils.extract_face_embedding(contents)
                if err or emb is None:
                    raise HTTPException(status_code=400, detail=f"Biometric extraction failed: {err}")
                import json
                face_vector_json = json.dumps(emb)

    updated = database.update_employee(
        emp_code=emp_code,
        name=name,
        email=email,
        department=department,
        designation=designation,
        branch_id=branch_id,
        device_id=device_id,
        face_embedding_json=face_vector_json,
        password=password
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Could not update employee or no changes detected.")

    return {
        "success": True,
        "message": f"Employee '{emp_code}' updated successfully.",
        "biometrics_re_enrolled": face_vector_json is not None
    }


@app.delete("/api/employees/{emp_code}")
def delete_employee_record(emp_code: str):
    """Deletes an employee."""
    deleted = database.delete_employee(emp_code)
    if not deleted:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return {"success": True, "message": f"Employee '{emp_code}' removed."}


@app.get("/api/office/branches")
def get_office_branches(only_active: bool = False):
    """Lists corporate office branches / geofences."""
    return database.list_office_branches(only_active=only_active)


@app.post("/api/office/branches")
def create_office_branch(b: BranchCreateRequest):
    """Creates a new office branch with GPS geofence."""
    branch_id = database.add_office_branch(
        name=b.name,
        address=b.address,
        latitude=b.latitude,
        longitude=b.longitude,
        radius_meters=b.radius_meters,
        office_wifi_bssid=b.office_wifi_bssid,
        office_public_ip=b.office_public_ip
    )
    return {"success": True, "id": branch_id, "message": f"Office Branch '{b.name}' created."}


@app.delete("/api/office/branches/{branch_id}")
def remove_office_branch(branch_id: int):
    """Deactivates an office branch."""
    deleted = database.delete_office_branch(branch_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Branch not found.")
    return {"success": True, "message": f"Branch #{branch_id} deleted."}


@app.post("/api/employee/clock-in")
async def employee_clock_in(
    emp_code: str = Form(...),
    device_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    is_mock: bool = Form(False),
    selfie: UploadFile = File(...)
):
    """
    Morning Clock-In with 4-Tier Security Verification:
    1. Employee profile and hardware device validation
    2. GPS Office Geofence verification
    3. 128-d Face Biometric match
    4. Anti-Spoofing & Liveness detection
    """
    emp = database.get_employee(emp_code)
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee '{emp_code}' is not registered.")

    registered_device = emp["device_id"]
    device_verified = (device_id.strip() == registered_device.strip())

    # Allocated Office Branch Geofence validation
    assigned_branch_id = emp.get("branch_id")
    assigned_branch = database.get_office_branch(assigned_branch_id) if assigned_branch_id else None

    if assigned_branch and assigned_branch.get("is_active"):
        distance_to_branch = geo_utils.haversine_distance_meters(
            latitude, longitude, assigned_branch["latitude"], assigned_branch["longitude"]
        )
        radius_meters = assigned_branch.get("radius_meters", 100.0)
        location_verified = (distance_to_branch <= (radius_meters + 150.0))
        branch_name = assigned_branch["name"]
    else:
        branches = database.list_office_branches(only_active=True)
        nearest_branch, distance_to_branch, location_verified = geo_utils.find_nearest_zone(
            latitude, longitude, branches, drift_tolerance_meters=150.0
        )
        branch_name = nearest_branch["name"] if nearest_branch else "Office Branch"
        radius_meters = nearest_branch["radius_meters"] if nearest_branch else 100.0
        if not branches:
            location_verified = True

    # Biometric Face Verification
    selfie_bytes = await selfie.read()
    if not selfie_bytes:
        raise HTTPException(status_code=400, detail="Captured selfie photo is empty.")

    live_embedding = face_utils.extract_face_embedding_from_bytes(selfie_bytes)
    face_verified = False
    similarity_score = 0.0

    face_distance = None
    if live_embedding is not None:
        enrolled_embedding = face_utils.deserialize_embedding(emp["face_embedding"])
        face_verified, face_distance, similarity_score = face_utils.compare_embeddings(
            live_embedding, enrolled_embedding, tolerance=0.48
        )

    # Anti-Spoofing Liveness check
    liveness_eval = anti_spoofing.evaluate_liveness(selfie_bytes)
    liveness_verified = liveness_eval["is_live"]
    liveness_score = liveness_eval["liveness_score"]

    print(f"📷 [BIOMETRICS] Clock-In: {emp_code} ({emp['name']}) | Face Match: {similarity_score}% (dist: {round(face_distance, 4) if face_distance is not None else 'N/A'}) | Verified: {face_verified} | Liveness: {liveness_score}%")

    if face_verified and liveness_verified:
        if not registered_device:
            database.update_employee_device(emp_code, device_id.strip())
            device_verified = True

    # Security decisions
    fail_reasons = []
    if is_mock:
        fail_reasons.append("Mock GPS detected! Please disable fake location providers.")
    if not device_verified:
        fail_reasons.append(f"Device mismatch (registered '{registered_device}', got '{device_id}')")
    if not location_verified:
        fail_reasons.append(f"Outside office ({distance_to_branch:.1f}m from '{branch_name}', allowed: {radius_meters}m)")
    if live_embedding is None:
        fail_reasons.append("No face detected in selfie. Please align your face inside the circle.")
    elif not face_verified:
        fail_reasons.append(f"Biometric mismatch (Confidence: {similarity_score}% - required: >=60%)")
    if not liveness_verified:
        fail_reasons.append(f"Spoof detected (Liveness: {liveness_score}%, {liveness_eval['message']})")

    checks_payload = {
        "device": {
            "passed": device_verified,
            "registered_device": registered_device,
            "provided_device": device_id
        },
        "location": {
            "passed": location_verified,
            "distance_meters": round(distance_to_branch, 1),
            "zone_name": branch_name
        },
        "face": {
            "passed": face_verified,
            "face_detected": live_embedding is not None,
            "distance": round(face_distance, 4) if face_distance is not None else None,
            "similarity_score": similarity_score,
            "threshold": 0.48
        },
        "liveness": {
            "passed": liveness_verified,
            "score": liveness_score,
            "message": liveness_eval.get("message")
        }
    }

    if fail_reasons:
        return {
            "success": False,
            "status": "REJECTED",
            "message": "Clock-In rejected: " + "; ".join(fail_reasons),
            "checks": checks_payload,
            "diagnostics": {
                "device_verified": device_verified,
                "location_verified": location_verified,
                "face_verified": face_verified,
                "liveness_verified": liveness_verified,
                "is_mock": is_mock,
                "distance_to_branch": distance_to_branch
            }
        }

    # Record Clock-In in Database
    res = database.clock_in_employee(
        emp_code=emp_code,
        emp_name=emp["name"],
        department=emp["department"],
        latitude=latitude,
        longitude=longitude,
        device_id=device_id,
        zone_name=branch_name,
        distance_to_zone=distance_to_branch,
        liveness_score=liveness_score,
        is_mock=is_mock,
        similarity_score=similarity_score,
        face_distance=face_distance
    )
    res["checks"] = checks_payload
    res["diagnostics"] = {
        "similarity_score": similarity_score,
        "liveness_score": liveness_score,
        "distance_meters": round(distance_to_branch, 1),
        "branch_name": branch_name
    }
    return res


@app.post("/api/employee/clock-out")
async def employee_clock_out(
    emp_code: str = Form(...),
    device_id: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    is_mock: bool = Form(False),
    selfie: UploadFile = File(...)
):
    """
    Evening Clock-Out:
    Verifies face and location, records departure time, and computes total net hours inside office.
    """
    emp = database.get_employee(emp_code)
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee '{emp_code}' is not registered.")

    # Allocated Office Branch Geofence validation
    assigned_branch_id = emp.get("branch_id")
    assigned_branch = database.get_office_branch(assigned_branch_id) if assigned_branch_id else None

    if assigned_branch and assigned_branch.get("is_active"):
        distance_to_branch = geo_utils.haversine_distance_meters(
            latitude, longitude, assigned_branch["latitude"], assigned_branch["longitude"]
        )
        radius_meters = assigned_branch.get("radius_meters", 100.0)
        location_verified = (distance_to_branch <= (radius_meters + 150.0))
        branch_name = assigned_branch["name"]
    else:
        branches = database.list_office_branches(only_active=True)
        nearest_branch, distance_to_branch, location_verified = geo_utils.find_nearest_zone(
            latitude, longitude, branches, drift_tolerance_meters=150.0
        )
        branch_name = nearest_branch["name"] if nearest_branch else "Office Branch"
        if not branches:
            location_verified = True

    selfie_bytes = await selfie.read()
    if not selfie_bytes:
        raise HTTPException(status_code=400, detail="Captured selfie photo is empty.")

    live_embedding = face_utils.extract_face_embedding_from_bytes(selfie_bytes)
    face_verified = False
    similarity_score = 0.0

    face_distance = None
    if live_embedding is not None:
        enrolled_embedding = face_utils.deserialize_embedding(emp["face_embedding"])
        face_verified, face_distance, similarity_score = face_utils.compare_embeddings(
            live_embedding, enrolled_embedding, tolerance=0.48
        )

    liveness_eval = anti_spoofing.evaluate_liveness(selfie_bytes)
    liveness_score = liveness_eval["liveness_score"]

    print(f"📷 [BIOMETRICS] Clock-Out: {emp_code} ({emp['name']}) | Face Match: {similarity_score}% (dist: {round(face_distance, 4) if face_distance is not None else 'N/A'}) | Verified: {face_verified}")

    if not face_verified:
        return {
            "success": False,
            "status": "REJECTED_FACE",
            "message": f"Biometric mismatch on Clock-Out (Confidence: {similarity_score}% - required: >=60%). Face verification required to close shift."
        }

    res = database.clock_out_employee(
        emp_code=emp_code,
        latitude=latitude,
        longitude=longitude,
        device_id=device_id,
        zone_name=branch_name,
        distance_to_zone=distance_to_branch,
        liveness_score=liveness_score,
        is_mock=is_mock
    )
    return res


@app.post("/api/employee/break/start")
def start_break(req: BreakRequest):
    """Pauses employee work timer for Lunch or Tea break."""
    return database.start_employee_break(req.emp_code, req.break_type or "LUNCH")


@app.post("/api/employee/break/end")
def end_break(req: BreakRequest):
    """Resumes employee work timer and records break duration."""
    return database.end_employee_break(req.emp_code)


@app.get("/api/office/radar")
def get_office_radar():
    """Returns live presence board ('Who's in the Office Right Now') for HR Dashboard."""
    return database.get_today_office_radar()


@app.get("/api/office/timesheets")
def get_office_timesheets(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    emp_code: Optional[str] = Query(None),
    department: Optional[str] = Query("ALL")
):
    """Retrieves detailed daily employee timesheets with gross hours, break time, and net hours."""
    return database.get_office_timesheets(start_date, end_date, emp_code, department)


@app.get("/api/office/export-timesheets-csv")
def export_office_timesheets_csv(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department: Optional[str] = Query("ALL")
):
    """Exports corporate employee attendance timesheets to CSV formatted for payroll processing."""
    records = database.get_office_timesheets(start_date=start_date, end_date=end_date, department=department)

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Record ID", "Date", "Employee Code", "Employee Name", "Department", "Designation",
        "Office Branch", "Clock-In Time", "Clock-Out Time", "Break (Mins)", "Net Work Hours",
        "Arrival Status", "Minutes Late", "Is Overtime", "Overtime Hours", "Status", "Audit Notes"
    ])

    for r in records:
        writer.writerow([
            r.get("id"), r.get("date"), r.get("emp_code"), r.get("emp_name"),
            r.get("department"), r.get("designation"), r.get("branch_name") or r.get("clock_in_zone_name"),
            r.get("clock_in_time"), r.get("clock_out_time"), r.get("total_break_minutes", 0),
            r.get("net_work_hours", 0.0), r.get("arrival_status"), r.get("minutes_late", 0),
            "Yes" if r.get("is_overtime") else "No", r.get("overtime_hours", 0.0),
            r.get("status"), r.get("audit_notes")
        ])

    output.seek(0)
    filename = f"office_timesheets_{database.get_now_ist().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/office/stats")
def get_office_stats():
    """Returns real-time corporate office metrics for HR Dashboard."""
    return database.get_office_stats()


@app.post("/api/office/reset-system")
def reset_system():
    """Wipes all old accounts, attendance logs, and break records for a clean fresh start."""
    return database.reset_system_to_fresh()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)


@app.delete("/api/office/timesheets/{timesheet_id}")
def delete_timesheet_endpoint(timesheet_id: int):
    """Deletes a single timesheet record (Admin only)."""
    deleted = database.delete_timesheet_record(timesheet_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Timesheet record not found.")
    return {"success": True, "message": f"Timesheet record #{timesheet_id} deleted."}


@app.delete("/api/attendance/records/{record_id}")
def delete_audit_record_endpoint(record_id: int):
    """Deletes a single audit log record (Admin only)."""
    deleted = database.delete_attendance_audit_record(record_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Audit record not found.")
    return {"success": True, "message": f"Audit record #{record_id} deleted."}


@app.post("/api/office/reset-employee-data/{emp_code}")
def reset_employee_data_endpoint(emp_code: str):
    """Resets all attendance records and punches for a single employee (Admin only)."""
    emp = database.get_employee(emp_code)
    if not emp:
        raise HTTPException(status_code=404, detail=f"Employee '{emp_code}' not found.")
    database.reset_employee_attendance(emp_code)
    return {
        "success": True,
        "message": f"All attendance punches and timesheets reset for employee '{emp.get('name') or emp_code}'."
    }

"""
Automated Test Suite for Smart Attendance API
Tests all endpoints including:
- Health & System Stats
- Student Registration & Biometric Embedding Extraction
- Classroom Geofence Management
- Anti-Proxy Device ID Binding
- GPS Haversine Geofence Verification
- Face Recognition Verification
- Attendance Audit Logging & Export
"""

import os
from fastapi.testclient import TestClient
from main import app, database

client = TestClient(app)

TEST_DIR = os.path.dirname(os.path.abspath(__file__))
ENROLL_IMG = os.path.join(TEST_DIR, "test_images", "student_enroll.jpg")
SELFIE_IMG = os.path.join(TEST_DIR, "test_images", "student_selfie.jpg")


def run_tests():
    print("=" * 65)
    print(" SMART ATTENDANCE SYSTEM - AUTOMATED INTEGRATION TESTS ")
    print("=" * 65)

    database.init_db()

    # 0. College Timetable Schedule & Auth Endpoints
    print("\n[Test 0] 8-Hour Timetable Schedule Verification...")
    res = client.get("/api/schedule/periods")
    assert res.status_code == 200, f"Failed: {res.text}"
    sched_periods = res.json()
    assert len(sched_periods) == 8, f"Expected 8 periods, got {len(sched_periods)}"
    print(f" -> Successfully seeded {len(sched_periods)} timetable periods (Periods 1-7 + Lunch Break).")

    res_sched = client.get("/api/schedule/current")
    assert res_sched.status_code == 200
    sched_info = res_sched.json()
    print(f" -> Server schedule status: {sched_info.get('window_status')}")

    # 1. Health check
    print("\n[Test 1] Health Check Endpoint...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    print(f" -> Status: {health_data['status']}")
    print(f" -> Face Engine Ready: {health_data['face_engine_ready']}")
    assert health_data["face_engine_ready"] is True

    # 2. Zones verification
    print("\n[Test 2] Geofence Zones Verification...")
    res = client.get("/api/zones")
    assert res.status_code == 200
    zones = res.json()
    print(f" -> Found {len(zones)} active zone(s).")
    assert len(zones) >= 1
    zone = zones[0]
    print(f" -> Testing Zone: '{zone['name']}' at ({zone['latitude']}, {zone['longitude']}), Radius: {zone['radius_meters']}m")

    # 3. Register Student with Facial Photo
    print("\n[Test 3] Student Biometric Enrollment...")
    student_id = "STU-2026-TEST"
    registered_device = "Pixel7-SECURE-99"

    with open(ENROLL_IMG, "rb") as f:
        res = client.post(
            "/api/students/register",
            data={
                "student_id": student_id,
                "name": "Jordan Miller",
                "email": "jordan.miller@university.edu",
                "device_id": registered_device
            },
            files={"photo": ("enroll.jpg", f, "image/jpeg")}
        )
    assert res.status_code == 200, f"Registration failed: {res.text}"
    reg_data = res.json()
    print(f" -> Registration Success: {reg_data['success']}")
    print(f" -> 128-d Vector extracted: {reg_data['biometric_details']['dimensions']} floats.")
    print(f" -> Vector sample (5 values): {reg_data['biometric_details']['vector_sample']}")

    # 4. Check Students List & Student Login Authentication
    print("\n[Test 4] Verifying Student Directory & Student Login...")
    res = client.get("/api/students")
    students = res.json()
    found = any(s["student_id"] == student_id for s in students)
    print(f" -> Student '{student_id}' present in database: {found}")
    assert found

    # Student Login test
    login_res = client.post("/api/student/login", json={"student_id": student_id, "password": "student123"})
    assert login_res.status_code == 200, f"Student login failed: {login_res.text}"
    print(f" -> [PASS] Student Login successful with default credentials! Token generated.")

    # 4b. 30-Minute Lockout Test (>30m late rejected with HTTP 403)
    print("\n[Test 4b] Testing 30-Minute Period Lockout Rule (>30m late)...")
    orig_sched_fn = database.get_current_schedule_info
    database.get_current_schedule_info = lambda target_dt=None, student_id=None: {
        "server_time": "2026-10-15 09:35:00",
        "today_date": "2026-10-15",
        "window_status": "LOCKED_OUT",
        "arrival_status": "LOCKED_OUT",
        "minutes_late": 35,
        "can_check_in": False,
        "current_period": {"id": 1, "name": "Period 1", "start_time": "09:00", "end_time": "10:00", "is_break": 0},
        "next_period": {"id": 2, "name": "Period 2", "start_time": "10:00", "end_time": "11:00", "is_break": 0},
        "minutes_elapsed": 35.0,
        "minutes_remaining_in_period": 25.0,
        "minutes_remaining_in_window": 0,
        "minutes_until_next": 25.0,
        "alert_5_min_before": False,
        "message": "Late by > 30 mins! Attendance closed for Period 1.",
        "already_checked_in": False
    }

    with open(ENROLL_IMG, "rb") as f:
        lockout_res = client.post(
            "/api/attendance/check-in",
            data={
                "student_id": student_id,
                "device_id": registered_device,
                "latitude": zone["latitude"],
                "longitude": zone["longitude"]
            },
            files={"selfie": ("photo.jpg", f, "image/jpeg")}
        )
    assert lockout_res.status_code == 403, f"Expected 403 lockout, got {lockout_res.status_code}: {lockout_res.text}"
    print(" -> [PASS] 30-minute lockout strictly enforced! Server returned HTTP 403.")

    # Now set schedule mock to active ON_TIME window (09:05 AM, 5m elapsed) for multi-factor check-in tests
    database.get_current_schedule_info = lambda target_dt=None, student_id=None: {
        "server_time": "2026-10-15 09:05:00",
        "today_date": "2026-10-15",
        "window_status": "OPEN_ON_TIME",
        "arrival_status": "ON_TIME",
        "minutes_late": 0,
        "can_check_in": True,
        "current_period": {"id": 1, "name": "Period 1", "start_time": "09:00", "end_time": "10:00", "is_break": 0},
        "next_period": {"id": 2, "name": "Period 2", "start_time": "10:00", "end_time": "11:00", "is_break": 0},
        "minutes_elapsed": 5.0,
        "minutes_remaining_in_period": 55.0,
        "minutes_remaining_in_window": 25.0,
        "minutes_until_next": 55.0,
        "alert_5_min_before": False,
        "message": "Class active",
        "already_checked_in": False
    }

    # 5. Check-In Test A: Device ID Mismatch (Anti-Proxy Check)
    print("\n[Test 5] Anti-Proxy Test (Attempt with attacker's unauthorized phone)...")
    with open(ENROLL_IMG, "rb") as f:
        res = client.post(
            "/api/attendance/check-in",
            data={
                "student_id": student_id,
                "device_id": "AttackerPhone-Proxy-007",  # WRONG DEVICE
                "latitude": zone["latitude"],
                "longitude": zone["longitude"]
            },
            files={"selfie": ("photo.jpg", f, "image/jpeg")}
        )
    assert res.status_code == 200
    res_a = res.json()
    print(f" -> Overall Passed: {res_a['success']}")
    print(f" -> Status: {res_a['status']}")
    print(f" -> Device Check Passed: {res_a['checks']['device']['passed']}")
    assert res_a["success"] is False
    assert res_a["checks"]["device"]["passed"] is False
    print(" -> [PASS] Anti-Proxy successfully blocked unauthorized device!")

    # 6. Check-In Test B: GPS Geofence Violation (Student trying to check in from home)
    print("\n[Test 6] Geofence Violation Test (Student 1.5 km away from classroom)...")
    with open(ENROLL_IMG, "rb") as f:
        res = client.post(
            "/api/attendance/check-in",
            data={
                "student_id": student_id,
                "device_id": registered_device,  # Correct device
                "latitude": zone["latitude"] + 0.015,  # ~1.6 km away
                "longitude": zone["longitude"] + 0.015
            },
            files={"selfie": ("photo.jpg", f, "image/jpeg")}
        )
    assert res.status_code == 200
    res_b = res.json()
    print(f" -> Overall Passed: {res_b['success']}")
    print(f" -> Status: {res_b['status']}")
    print(f" -> Location Check Passed: {res_b['checks']['location']['passed']}")
    print(f" -> Distance Measured: {res_b['checks']['location']['distance_meters']}m (Radius: {zone['radius_meters']}m)")
    assert res_b["success"] is False
    assert res_b["checks"]["location"]["passed"] is False
    print(" -> [PASS] GPS Geofence successfully blocked out-of-boundary check-in!")

    # 7. Check-In Test C: Successful Multi-Factor Check-In (Valid Device + Inside Classroom + Matching Face + Liveness)
    print("\n[Test 7] Full Multi-Factor Success Check-In (Correct Device + Inside Zone + Matching Face + Liveness)...")
    with open(ENROLL_IMG, "rb") as f:
        res = client.post(
            "/api/attendance/check-in",
            data={
                "student_id": student_id,
                "device_id": registered_device,
                "latitude": zone["latitude"] + 0.00005,  # ~5 meters from center
                "longitude": zone["longitude"] + 0.00005
            },
            files={"selfie": ("selfie.jpg", f, "image/jpeg")}
        )
    assert res.status_code == 200
    res_c = res.json()
    print(f" -> Overall Passed: {res_c['success']}")
    print(f" -> Status: {res_c['status']}")
    print(f" -> Device Match: {res_c['checks']['device']['passed']}")
    print(f" -> Location Inside: {res_c['checks']['location']['passed']} ({res_c['checks']['location']['distance_meters']}m away)")
    print(f" -> Face Match: {res_c['checks']['face']['passed']} (Distance: {res_c['checks']['face']['distance']}, Score: {res_c['checks']['face']['similarity_score']}%)")
    print(f" -> Liveness Verified: {res_c['checks']['liveness']['passed']} (Score: {res_c['checks']['liveness']['score']}%)")
    assert res_c["success"] is True
    assert res_c["status"] == "SUCCESS"
    assert res_c["checks"]["liveness"]["passed"] is True
    print(" -> [PASS] Attendance authenticated and logged successfully!")

    # 8. Check-In Test D: Presentation Attack / Anti-Spoofing Defense Test
    print("\n[Test 8] Anti-Spoofing Defense Test (Simulated Paper Photo Presentation Attack)...")
    import cv2
    img = cv2.imread(ENROLL_IMG)
    blurred_spoof = cv2.GaussianBlur(img, (27, 27), 0)
    _, spoof_buf = cv2.imencode(".jpg", blurred_spoof)
    spoof_bytes = spoof_buf.tobytes()

    res = client.post(
        "/api/attendance/check-in",
        data={
            "student_id": student_id,
            "device_id": registered_device,
            "latitude": zone["latitude"],
            "longitude": zone["longitude"]
        },
        files={"selfie": ("spoof_paper.jpg", spoof_bytes, "image/jpeg")}
    )
    assert res.status_code == 200
    res_d = res.json()
    print(f" -> Overall Passed: {res_d['success']}")
    print(f" -> Status: {res_d['status']}")
    print(f" -> Liveness Passed: {res_d['checks']['liveness']['passed']} (Score: {res_d['checks']['liveness']['score']}%)")
    print(f" -> PAD Warnings: {res_d['checks']['liveness']['warnings']}")
    assert res_d["success"] is False
    assert res_d["status"] == "REJECTED_SPOOF"
    print(" -> [PASS] Anti-Spoofing PAD successfully blocked simulated photo attack!")

    # 9. Standalone Liveness Evaluation Endpoint
    print("\n[Test 9] Standalone Liveness Evaluation Endpoint (/api/liveness/evaluate)...")
    with open(SELFIE_IMG, "rb") as f:
        res = client.post("/api/liveness/evaluate", files={"photo": ("live.jpg", f, "image/jpeg")})
    assert res.status_code == 200
    live_eval = res.json()
    print(f" -> Is Live: {live_eval['is_live']}, Score: {live_eval['liveness_score']}%, Status: {live_eval['status']}")
    assert live_eval["is_live"] is True

    # 10. Check Attendance Records
    print("\n[Test 10] Fetching Attendance Audit Logs...")
    res = client.get("/api/attendance/records?limit=10")
    assert res.status_code == 200
    records = res.json()
    print(f" -> Found {len(records)} audit log record(s).")
    assert len(records) >= 4

    # 11. Check CSV Export
    print("\n[Test 11] Testing CSV Export...")
    res = client.get("/api/attendance/export-csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Liveness Score" in res.text
    print(" -> [PASS] CSV generated with Liveness Score columns.")

    # 12. Dashboard Stats
    print("\n[Test 12] Testing Live Dashboard Metrics...")
    res = client.get("/api/stats")
    assert res.status_code == 200
    stats = res.json()
    print(f" -> Total Students: {stats['total_students']}")
    print(f" -> Total Check-In Records: {stats['total_records']}")
    print(f" -> Total Successful: {stats['total_success']}")
    print(f" -> Success Rate: {stats['success_rate']}%")

    # 13. Student Day-Wise Attendance History API
    print("\n[Test 13] Testing Student Day-Wise Attendance History API...")
    res = client.get(f"/api/attendance/student-day-history?student_id={student_id}&date=2026-10-15")
    assert res.status_code == 200, f"Failed: {res.text}"
    history_data = res.json()
    assert history_data["total_periods"] == 7
    assert len(history_data["timeline"]) == 8
    print(f" -> Attendance Score: {history_data['attended_count']} / {history_data['total_periods']} ({history_data['attendance_percentage']}%)")
    print(f" -> Periods breakdown: {len(history_data['timeline'])} periods verified.")
    print(" -> [PASS] Student Day-Wise History API working as expected.")

    # Restore original schedule function
    database.get_current_schedule_info = orig_sched_fn

    print("\n" + "=" * 65)
    print(" ALL INTEGRATION & HOURLY TIMETABLE TESTS PASSED! ")
    print("=" * 65)


if __name__ == "__main__":
    run_tests()

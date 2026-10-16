"""
Database Module for Smart Attendance System
SQLite implementation with strict privacy guarantees:
Raw facial images are NEVER stored. Only mathematical vectors (128-d float embeddings)
are stored in serialized format after explicit registration.
"""

import sqlite3
import os
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any

# Indian Standard Time (IST: UTC+05:30)
IST_TZ = timezone(timedelta(hours=5, minutes=30))

def get_now_ist() -> datetime:
    """Returns the current real time in Indian Standard Time (IST: UTC+05:30)."""
    return datetime.now(IST_TZ).replace(tzinfo=None)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "attendance.db")


def hash_password(password: str) -> str:
    """Computes SHA-256 hash with salt for secure storage."""
    salt = "SmartAttendanceSalt_2026"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()


def get_db_connection() -> sqlite3.Connection:
    """Creates a thread-safe connection with dictionary-like row access and WAL mode for high concurrency."""
    conn = sqlite3.connect(DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def init_db() -> None:
    """Initializes the SQLite database tables and default sample zones."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # 1. Students Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                device_id TEXT NOT NULL,
                face_embedding TEXT NOT NULL,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Migration: ensure password_hash exists in students table
        try:
            cursor.execute("ALTER TABLE students ADD COLUMN password_hash TEXT")
        except sqlite3.OperationalError:
            pass

        # 2. Geofence Zones Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS geofence_zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                radius_meters REAL NOT NULL DEFAULT 50.0,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 3. Class Periods Schedule Table (8-hour college schedule: 9 AM - 5 PM, with 1-2 PM lunch break)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS class_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_num INTEGER NOT NULL,
                name TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                is_break INTEGER DEFAULT 0
            );
        """)

        # Seed the 7 class periods + 1 lunch break if table is empty
        cursor.execute("SELECT COUNT(*) FROM class_periods")
        if cursor.fetchone()[0] == 0:
            default_schedule = [
                (1, "Period 1", "09:00", "10:00", 0),
                (2, "Period 2", "10:00", "11:00", 0),
                (3, "Period 3", "11:00", "12:00", 0),
                (4, "Period 4", "12:00", "13:00", 0),
                (0, "Lunch Break", "13:00", "14:00", 1),
                (5, "Period 5", "14:00", "15:00", 0),
                (6, "Period 6", "15:00", "16:00", 0),
                (7, "Period 7", "16:00", "17:00", 0),
            ]
            cursor.executemany("""
                INSERT INTO class_periods (period_num, name, start_time, end_time, is_break)
                VALUES (?, ?, ?, ?, ?)
            """, default_schedule)

        # 4. Attendance Records Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                student_name TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                attendance_date TEXT,
                period_id INTEGER,
                period_name TEXT,
                arrival_status TEXT DEFAULT 'ON_TIME',
                minutes_late INTEGER DEFAULT 0,
                device_id TEXT NOT NULL,
                device_verified INTEGER NOT NULL,
                user_latitude REAL NOT NULL,
                user_longitude REAL NOT NULL,
                zone_id INTEGER,
                zone_name TEXT,
                distance_to_zone_meters REAL,
                location_verified INTEGER NOT NULL,
                face_distance REAL,
                face_similarity_score REAL,
                face_verified INTEGER NOT NULL,
                liveness_score REAL DEFAULT 100.0,
                liveness_verified INTEGER DEFAULT 1,
                status TEXT NOT NULL,
                message TEXT
            );
        """)

        # Migrations: ensure new period & liveness columns exist if table was previously created
        new_cols = [
            ("liveness_score", "REAL DEFAULT 100.0"),
            ("liveness_verified", "INTEGER DEFAULT 1"),
            ("attendance_date", "TEXT"),
            ("period_id", "INTEGER"),
            ("period_name", "TEXT"),
            ("arrival_status", "TEXT DEFAULT 'ON_TIME'"),
            ("minutes_late", "INTEGER DEFAULT 0"),
        ]
        for col_name, col_def in new_cols:
            try:
                cursor.execute(f"ALTER TABLE attendance_records ADD COLUMN {col_name} {col_def}")
            except sqlite3.OperationalError:
                pass

        # 5. Admins / Faculty Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT DEFAULT 'faculty',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Seed default Faculty Admin account if none exist (Default: admin / admin123)
        cursor.execute("SELECT COUNT(*) FROM admins")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO admins (username, password_hash, full_name, role)
                VALUES (?, ?, ?, ?)
            """, ("admin", hash_password("admin123"), "Faculty Administrator", "admin"))

        conn.commit()


# ==========================================
# Admin / Faculty Authentication Operations
# ==========================================

def verify_admin(username: str, password: str) -> Optional[Dict[str, Any]]:
    """Verifies admin credentials and returns user details on match."""
    p_hash = hash_password(password.strip())
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, full_name, role, created_at
            FROM admins
            WHERE username = ? AND password_hash = ?
        """, (username.strip(), p_hash))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_admin_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Retrieves admin by username."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, full_name, role FROM admins WHERE username = ?", (username.strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None



# ==========================================
# Student Operations & Authentication
# ==========================================

def verify_student(student_id: str, password: str) -> Optional[Dict[str, Any]]:
    """Verifies student login credentials (student_id + password)."""
    p_hash = hash_password(password.strip())
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, student_id, name, email, device_id, created_at, password_hash
            FROM students
            WHERE student_id = ?
        """, (student_id.strip(),))
        row = cursor.fetchone()
        if not row:
            return None
        
        # If student has no password set yet, accept default password "student123"
        stored_hash = row["password_hash"]
        if not stored_hash:
            if password.strip() == "student123":
                # Automatically initialize password_hash
                cursor.execute("UPDATE students SET password_hash = ? WHERE student_id = ?", (p_hash, student_id.strip()))
                conn.commit()
                res = dict(row)
                del res["password_hash"]
                return res
            return None
        
        if stored_hash == p_hash:
            res = dict(row)
            del res["password_hash"]
            return res
        return None


def add_student(
    student_id: str,
    name: str,
    email: Optional[str],
    device_id: str,
    face_embedding_json: str,
    password: Optional[str] = "student123"
) -> bool:
    """Inserts or updates a student profile with bound device, face embedding, and password hash."""
    p_hash = hash_password(password.strip() if password else "student123")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO students (student_id, name, email, device_id, face_embedding, password_hash)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                device_id = excluded.device_id,
                face_embedding = excluded.face_embedding,
                password_hash = COALESCE(excluded.password_hash, students.password_hash)
        """, (student_id.strip(), name.strip(), email.strip() if email else None, device_id.strip(), face_embedding_json, p_hash))
        conn.commit()
    return True


def get_student(student_id: str) -> Optional[Dict[str, Any]]:
    """Fetches student record by student_id."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM students WHERE student_id = ?", (student_id.strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_student_device(student_id: str, device_id: str) -> bool:
    """Updates and binds the student's hardware device ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE students SET device_id = ? WHERE student_id = ?", (device_id.strip(), student_id.strip()))
        conn.commit()
        return cursor.rowcount > 0


def list_students() -> List[Dict[str, Any]]:
    """Returns list of all students without embedding vectors to conserve payload."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, student_id, name, email, device_id, created_at
            FROM students
            ORDER BY created_at DESC
        """)
        return [dict(r) for r in cursor.fetchall()]


def delete_student(student_id: str) -> bool:
    """Deletes a student record."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM students WHERE student_id = ?", (student_id.strip(),))
        conn.commit()
        return cursor.rowcount > 0


# ==========================================
# Geofence Zone Operations
# ==========================================

def get_zones(only_active: bool = False) -> List[Dict[str, Any]]:
    """Fetches all or only active geofence zones."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if only_active:
            cursor.execute("SELECT * FROM geofence_zones WHERE is_active = 1 ORDER BY id ASC")
        else:
            cursor.execute("SELECT * FROM geofence_zones ORDER BY id ASC")
        return [dict(r) for r in cursor.fetchall()]


def add_zone(name: str, latitude: float, longitude: float, radius_meters: float = 50.0) -> int:
    """Creates a new geofence zone."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO geofence_zones (name, latitude, longitude, radius_meters, is_active)
            VALUES (?, ?, ?, ?, 1)
        """, (name.strip(), float(latitude), float(longitude), float(radius_meters)))
        conn.commit()
        return cursor.lastrowid


def delete_zone(zone_id: int) -> bool:
    """Removes a geofence zone."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM geofence_zones WHERE id = ?", (zone_id,))
        conn.commit()
        return cursor.rowcount > 0


# ==========================================
# Timetable Schedule Operations
# ==========================================

# Global simulation time for testing period states (e.g. '09:45' for >30m lockout testing)
CURRENT_SIMULATED_TIME: Optional[str] = None


def set_global_simulated_time(time_str: Optional[str]) -> None:
    """Sets or clears simulated clock time (e.g. '09:45' for >30m lockout testing, None for real clock)."""
    global CURRENT_SIMULATED_TIME
    CURRENT_SIMULATED_TIME = time_str.strip() if time_str and time_str.strip() else None


def get_global_simulated_time() -> Optional[str]:
    return CURRENT_SIMULATED_TIME


def get_all_periods() -> List[Dict[str, Any]]:
    """Retrieves all periods in the 8-hour college schedule."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM class_periods ORDER BY id ASC")
        return [dict(r) for r in cursor.fetchall()]


def get_current_schedule_info(target_dt: Optional[datetime] = None, student_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Computes active period, arrival window status (0-10m on time, 10-30m late, >30m late entry),
    lunch break state, and real-time IST clock synchronization.
    Always allows check-in to ensure students are never locked out of attendance.
    """
    if target_dt is None and CURRENT_SIMULATED_TIME:
        try:
            today = get_now_ist()
            h, m = map(int, CURRENT_SIMULATED_TIME.split(":"))
            target_dt = datetime(today.year, today.month, today.day, h, m, 0)
        except Exception:
            pass

    now = target_dt or get_now_ist()
    now_time_str = now.strftime("%H:%M")
    real_time_display = now.strftime("%I:%M:%S %p")
    today_date_str = now.strftime("%Y-%m-%d")
    current_minutes = now.hour * 60 + now.minute + (now.second / 60.0)

    periods = get_all_periods()
    if not periods:
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "NO_SCHEDULE",
            "message": "No timetable configured.",
            "can_check_in": True
        }

    # Helper to parse HH:MM to minutes
    def to_mins(t_str: str) -> int:
        h, m = map(int, t_str.split(":"))
        return h * 60 + m

    first_start_mins = to_mins(periods[0]["start_time"])
    last_end_mins = to_mins(periods[-1]["end_time"])

    # 1. Before college hours (< 09:00)
    if current_minutes < first_start_mins:
        mins_until_first = first_start_mins - current_minutes
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "BEFORE_COLLEGE",
            "arrival_status": "EARLY_CHECKIN",
            "can_check_in": True,
            "current_period": periods[0],
            "next_period": periods[0],
            "minutes_elapsed": 0,
            "minutes_remaining_in_period": 0,
            "minutes_remaining_in_window": 0,
            "minutes_until_next": round(mins_until_first, 1),
            "alert_5_min_before": (mins_until_first <= 5.0),
            "message": f"College starts at {periods[0]['start_time']}. Early check-in accepted for {periods[0]['name']}.",
            "already_checked_in": False
        }

    # 2. After college hours (>= 17:00)
    if current_minutes >= last_end_mins:
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "COLLEGE_CLOSED",
            "arrival_status": "AFTER_HOURS",
            "can_check_in": True,
            "current_period": periods[-1],
            "next_period": None,
            "minutes_elapsed": 0,
            "minutes_remaining_in_period": 0,
            "minutes_remaining_in_window": 0,
            "minutes_until_next": 0,
            "alert_5_min_before": False,
            "message": "College hours completed for today (09:00 AM - 05:00 PM). Extra-session / After-Hours attendance enabled.",
            "already_checked_in": False
        }

    # 3. Within college schedule
    current_period = None
    next_period = None
    period_idx = -1

    for idx, p in enumerate(periods):
        p_start = to_mins(p["start_time"])
        p_end = to_mins(p["end_time"])
        if p_start <= current_minutes < p_end:
            current_period = p
            period_idx = idx
            if idx + 1 < len(periods):
                next_period = periods[idx + 1]
            break

    if not current_period:
        current_period = periods[0]
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "INTERMISSION",
            "arrival_status": "ON_TIME",
            "can_check_in": True,
            "current_period": current_period,
            "next_period": periods[0],
            "minutes_elapsed": 0,
            "minutes_remaining_in_period": 0,
            "minutes_remaining_in_window": 0,
            "minutes_until_next": 0,
            "alert_5_min_before": False,
            "message": "Class intermission. Attendance check-in active.",
            "already_checked_in": False
        }

    p_start_mins = to_mins(current_period["start_time"])
    p_end_mins = to_mins(current_period["end_time"])
    minutes_elapsed = current_minutes - p_start_mins
    mins_remaining_in_period = p_end_mins - current_minutes
    alert_5_min_before = (mins_remaining_in_period <= 5.0 and next_period is not None)

    # Check if student already checked in
    already_checked_in = False
    checked_in_record = None
    if student_id and not current_period["is_break"]:
        checked_in_record = has_student_checked_in_period(student_id, today_date_str, current_period["id"])
        if checked_in_record:
            already_checked_in = True

    # Case A: Lunch break (13:00 - 14:00)
    if current_period["is_break"]:
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "LUNCH_BREAK",
            "arrival_status": "RECESS_ENTRY",
            "can_check_in": True,
            "current_period": current_period,
            "next_period": next_period,
            "minutes_elapsed": round(minutes_elapsed, 1),
            "minutes_remaining_in_period": round(mins_remaining_in_period, 1),
            "minutes_remaining_in_window": 0,
            "minutes_until_next": round(mins_remaining_in_period, 1),
            "alert_5_min_before": alert_5_min_before,
            "message": f"Lunch Break (1:00 PM - 2:00 PM). Check-in enabled. Next class ({next_period['name'] if next_period else 'Period 5'}) starts at 02:00 PM.",
            "already_checked_in": False
        }

    # Case B: If student already checked in
    if already_checked_in:
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "ALREADY_VERIFIED",
            "arrival_status": checked_in_record.get("arrival_status", "PRESENT"),
            "can_check_in": True,
            "current_period": current_period,
            "next_period": next_period,
            "minutes_elapsed": round(minutes_elapsed, 1),
            "minutes_remaining_in_period": round(mins_remaining_in_period, 1),
            "minutes_remaining_in_window": max(0.0, round(30.0 - minutes_elapsed, 1)),
            "minutes_until_next": round(mins_remaining_in_period, 1),
            "alert_5_min_before": alert_5_min_before,
            "message": f"Attendance verified for {current_period['name']} ({checked_in_record.get('arrival_status', 'PRESENT')}). Re-verification enabled.",
            "already_checked_in": True,
            "record": checked_in_record
        }

    # Case C: Active period windows
    # 0 to 10 mins: On-time
    if 0 <= minutes_elapsed <= 10.0:
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "OPEN_ON_TIME",
            "arrival_status": "ON_TIME",
            "minutes_late": 0,
            "can_check_in": True,
            "current_period": current_period,
            "next_period": next_period,
            "minutes_elapsed": round(minutes_elapsed, 1),
            "minutes_remaining_in_period": round(mins_remaining_in_period, 1),
            "minutes_remaining_in_window": round(30.0 - minutes_elapsed, 1),
            "minutes_until_next": round(mins_remaining_in_period, 1),
            "alert_5_min_before": alert_5_min_before,
            "message": f"{current_period['name']} is Active! You are On-Time ({int(minutes_elapsed)}m elapsed).",
            "already_checked_in": False
        }

    # 10 to 30 mins: Late login
    elif 10.0 < minutes_elapsed <= 30.0:
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "OPEN_LATE",
            "arrival_status": "LATE",
            "minutes_late": int(minutes_elapsed),
            "can_check_in": True,
            "current_period": current_period,
            "next_period": next_period,
            "minutes_elapsed": round(minutes_elapsed, 1),
            "minutes_remaining_in_period": round(mins_remaining_in_period, 1),
            "minutes_remaining_in_window": round(30.0 - minutes_elapsed, 1),
            "minutes_until_next": round(mins_remaining_in_period, 1),
            "alert_5_min_before": alert_5_min_before,
            "message": f"Late Window for {current_period['name']} ({int(minutes_elapsed)}m late). Check-in allowed.",
            "already_checked_in": False
        }

    # > 30 mins: Late Entry allowed
    else:
        return {
            "server_time": now.strftime("%Y-%m-%d %H:%M:%S"),
            "today_date": today_date_str,
            "real_time_display": real_time_display,
            "timezone": "IST (UTC+05:30)",
            "window_status": "LATE_ENTRY",
            "arrival_status": "LATE",
            "minutes_late": int(minutes_elapsed),
            "can_check_in": True,
            "current_period": current_period,
            "next_period": next_period,
            "minutes_elapsed": round(minutes_elapsed, 1),
            "minutes_remaining_in_period": round(mins_remaining_in_period, 1),
            "minutes_remaining_in_window": 0,
            "minutes_until_next": round(mins_remaining_in_period, 1),
            "alert_5_min_before": alert_5_min_before,
            "message": f"{current_period['name']} is Active (Late entry: {int(minutes_elapsed)}m elapsed). Attendance accepted.",
            "already_checked_in": False
        }


def has_student_checked_in_period(student_id: str, attendance_date: str, period_id: int) -> Optional[Dict[str, Any]]:
    """Checks if a student has an existing SUCCESS record for this period on this date."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, student_id, student_name, timestamp, attendance_date, period_id, period_name, arrival_status, minutes_late, status
            FROM attendance_records
            WHERE student_id = ? AND attendance_date = ? AND period_id = ? AND status = 'SUCCESS'
            LIMIT 1
        """, (student_id.strip(), attendance_date.strip(), period_id))
        row = cursor.fetchone()
        return dict(row) if row else None


# ==========================================
# Attendance Operations
# ==========================================

def log_attendance(
    student_id: str,
    student_name: str,
    device_id: str,
    device_verified: bool,
    user_latitude: float,
    user_longitude: float,
    zone_id: Optional[int],
    zone_name: Optional[str],
    distance_to_zone_meters: Optional[float],
    location_verified: bool,
    face_distance: Optional[float],
    face_similarity_score: Optional[float],
    face_verified: bool,
    liveness_score: Optional[float] = 100.0,
    liveness_verified: bool = True,
    status: str = "SUCCESS",
    message: str = "",
    attendance_date: Optional[str] = None,
    period_id: Optional[int] = None,
    period_name: Optional[str] = None,
    arrival_status: Optional[str] = "ON_TIME",
    minutes_late: int = 0
) -> int:
    """Logs an attendance verification attempt with all multi-factor parameters and period tracking."""
    now_ist = get_now_ist()
    if not attendance_date:
        attendance_date = now_ist.strftime("%Y-%m-%d")

    timestamp_str = now_ist.strftime("%Y-%m-%d %H:%M:%S")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO attendance_records (
                student_id, student_name, timestamp, attendance_date, period_id, period_name,
                arrival_status, minutes_late, device_id, device_verified,
                user_latitude, user_longitude, zone_id, zone_name,
                distance_to_zone_meters, location_verified,
                face_distance, face_similarity_score, face_verified,
                liveness_score, liveness_verified,
                status, message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            student_id, student_name, timestamp_str, attendance_date, period_id, period_name,
            arrival_status, minutes_late, device_id, 1 if device_verified else 0,
            user_latitude, user_longitude, zone_id, zone_name,
            distance_to_zone_meters, 1 if location_verified else 0,
            face_distance, face_similarity_score, 1 if face_verified else 0,
            liveness_score, 1 if liveness_verified else 0,
            status, message
        ))
        conn.commit()
        return cursor.lastrowid


def get_student_day_history(student_id: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    Computes a student's full day attendance status across all 7 periods + 1 lunch break.
    """
    if not date_str:
        date_str = get_now_ist().strftime("%Y-%m-%d")

    periods = get_all_periods()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, student_id, student_name, timestamp, attendance_date,
                   period_id, period_name, arrival_status, minutes_late, status, message
            FROM attendance_records
            WHERE student_id = ? AND (attendance_date = ? OR date(timestamp) = ?) AND status = 'SUCCESS'
            ORDER BY id ASC
        """, (student_id.strip(), date_str.strip(), date_str.strip()))
        success_records = {r["period_id"]: dict(r) for r in cursor.fetchall()}

    timeline = []
    total_class_periods = 0
    attended_count = 0
    on_time_count = 0
    late_count = 0

    now = get_now_ist()
    now_date_str = now.strftime("%Y-%m-%d")
    current_minutes = now.hour * 60 + now.minute

    def to_mins(t_str: str) -> int:
        h, m = map(int, t_str.split(":"))
        return h * 60 + m

    for p in periods:
        p_id = p["id"]
        is_break = bool(p["is_break"])
        p_start_m = to_mins(p["start_time"])
        p_end_m = to_mins(p["end_time"])

        if is_break:
            timeline.append({
                "period_id": p_id,
                "period_num": 0,
                "name": p["name"],
                "start_time": p["start_time"],
                "end_time": p["end_time"],
                "is_break": True,
                "status": "BREAK",
                "status_label": "Lunch Break (1:00 PM - 2:00 PM)",
                "record": None
            })
            continue

        total_class_periods += 1
        record = success_records.get(p_id)

        if record:
            attended_count += 1
            arr_status = record.get("arrival_status", "ON_TIME")
            if arr_status == "LATE":
                late_count += 1
                status_label = f"Late ({record.get('minutes_late', 0)}m late)"
            else:
                on_time_count += 1
                status_label = "Present (On-Time)"

            timeline.append({
                "period_id": p_id,
                "period_num": p["period_num"],
                "name": p["name"],
                "start_time": p["start_time"],
                "end_time": p["end_time"],
                "is_break": False,
                "status": arr_status,
                "status_label": status_label,
                "timestamp": record["timestamp"],
                "minutes_late": record.get("minutes_late", 0),
                "record": record
            })
        else:
            # Check whether this period has already passed, is currently active, or is upcoming
            if date_str < now_date_str:
                status = "MISSED"
                status_label = "Absent / Missed"
            elif date_str > now_date_str:
                status = "UPCOMING"
                status_label = "Scheduled"
            else:
                # Today
                if current_minutes >= p_end_m:
                    status = "MISSED"
                    status_label = "Absent / Locked Out"
                elif p_start_m <= current_minutes < p_end_m:
                    if current_minutes - p_start_m > 30:
                        status = "LOCKED_OUT"
                        status_label = "Locked Out (>30m late)"
                    else:
                        status = "IN_PROGRESS"
                        status_label = "Class In Progress (Check In Now!)"
                else:
                    status = "UPCOMING"
                    status_label = "Upcoming"

            timeline.append({
                "period_id": p_id,
                "period_num": p["period_num"],
                "name": p["name"],
                "start_time": p["start_time"],
                "end_time": p["end_time"],
                "is_break": False,
                "status": status,
                "status_label": status_label,
                "timestamp": None,
                "minutes_late": 0,
                "record": None
            })

    attendance_percentage = round((attended_count / total_class_periods * 100), 1) if total_class_periods > 0 else 0.0

    return {
        "student_id": student_id,
        "date": date_str,
        "total_periods": total_class_periods,
        "attended_count": attended_count,
        "on_time_count": on_time_count,
        "late_count": late_count,
        "missed_count": max(0, total_class_periods - attended_count),
        "attendance_percentage": attendance_percentage,
        "timeline": timeline
    }


def get_attendance_records(
    student_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """Retrieves attendance history with optional filters."""
    query = "SELECT * FROM attendance_records WHERE 1=1"
    params: List[Any] = []

    if student_id:
        query += " AND student_id = ?"
        params.append(student_id.strip())

    if status and status.upper() != "ALL":
        query += " AND status = ?"
        params.append(status.strip())

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]


def get_stats() -> Dict[str, Any]:
    """Computes summary statistics for dashboard display."""
    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Total registered students
        cursor.execute("SELECT COUNT(*) FROM students")
        total_students = cursor.fetchone()[0]

        # Total zones
        cursor.execute("SELECT COUNT(*) FROM geofence_zones WHERE is_active = 1")
        total_zones = cursor.fetchone()[0]

        # Total attendance check-ins
        cursor.execute("SELECT COUNT(*) FROM attendance_records")
        total_records = cursor.fetchone()[0]

        # Total successful attendance
        cursor.execute("SELECT COUNT(*) FROM attendance_records WHERE status = 'SUCCESS'")
        total_success = cursor.fetchone()[0]

        # Today's check-ins
        cursor.execute("""
            SELECT COUNT(*) FROM attendance_records 
            WHERE date(timestamp) = date('now', 'localtime')
        """)
        today_total = cursor.fetchone()[0]

        cursor.execute("""
            SELECT COUNT(*) FROM attendance_records 
            WHERE date(timestamp) = date('now', 'localtime') AND status = 'SUCCESS'
        """)
        today_success = cursor.fetchone()[0]

        success_rate = round((total_success / total_records * 100), 1) if total_records > 0 else 100.0

        return {
            "total_students": total_students,
            "total_zones": total_zones,
            "total_records": total_records,
            "total_success": total_success,
            "today_total": today_total,
            "today_success": today_success,
            "success_rate": success_rate
        }

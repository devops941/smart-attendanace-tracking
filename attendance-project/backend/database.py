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

        # 6. Corporate Office Employees Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                emp_code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                department TEXT NOT NULL DEFAULT 'Engineering',
                designation TEXT NOT NULL DEFAULT 'Staff Member',
                branch_id INTEGER DEFAULT 1,
                device_id TEXT NOT NULL,
                face_embedding TEXT NOT NULL,
                password_hash TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 7. Office Branches / Campus Zones Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS office_branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                address TEXT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                radius_meters REAL NOT NULL DEFAULT 100.0,
                office_wifi_bssid TEXT,
                office_public_ip TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Office Branches table is created; branches are dynamically managed by the admin without static seed data.

        # 8. Office Employee Attendance (Clock-In / Clock-Out & Work Hours Tracking)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS office_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                emp_code TEXT NOT NULL,
                emp_name TEXT NOT NULL,
                department TEXT,
                date TEXT NOT NULL,
                clock_in_time TIMESTAMP,
                clock_out_time TIMESTAMP,
                total_break_minutes INTEGER DEFAULT 0,
                net_work_hours REAL DEFAULT 0.0,
                clock_in_lat REAL,
                clock_in_lon REAL,
                clock_in_device_id TEXT,
                clock_in_zone_name TEXT,
                clock_in_distance REAL,
                clock_out_lat REAL,
                clock_out_lon REAL,
                clock_out_device_id TEXT,
                clock_out_zone_name TEXT,
                clock_out_distance REAL,
                clock_in_liveness_score REAL DEFAULT 100.0,
                clock_out_liveness_score REAL DEFAULT 100.0,
                is_mock_location INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'CLOCKED_IN',
                arrival_status TEXT DEFAULT 'ON_TIME',
                minutes_late INTEGER DEFAULT 0,
                is_overtime INTEGER DEFAULT 0,
                overtime_hours REAL DEFAULT 0.0,
                audit_notes TEXT
            );
        """)

        # 9. Employee Breaks (Lunch, Coffee, Recess)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employee_breaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                emp_code TEXT NOT NULL,
                date TEXT NOT NULL,
                break_type TEXT DEFAULT 'LUNCH',
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                duration_minutes INTEGER DEFAULT 0
            );
        """)

        # Ensure default employees and active office branch exist
        seed_default_branch_only(cursor)

        conn.commit()


def get_sample_face_embedding() -> str:
    """Returns a valid 128-d reference face embedding vector for seed employees."""
    sample_file = os.path.join(os.path.dirname(__file__), "sample_embedding.json")
    if os.path.exists(sample_file):
        try:
            with open(sample_file, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return content
        except Exception:
            pass
    return json.dumps([0.05 * (i % 5 - 2) for i in range(128)])


def seed_default_branch_only(cursor) -> None:
    """Ensures an active office branch exists for office geofencing (no default employees seeded)."""
    cursor.execute("SELECT id FROM office_branches WHERE is_active = 1 LIMIT 1")
    branch_row = cursor.fetchone()
    if not branch_row:
        cursor.execute("""
            INSERT INTO office_branches (name, address, latitude, longitude, radius_meters, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, ("Corporate Headquarters", "Main Campus", 9.966781, 78.1357124, 150.0))


def reset_system_to_fresh() -> Dict[str, Any]:
    """Wipes all punches, breaks, timesheets, and employee accounts while retaining HR Admin."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM office_attendance")
        cursor.execute("DELETE FROM employee_breaks")
        cursor.execute("DELETE FROM attendance_records")
        cursor.execute("DELETE FROM employees")
        cursor.execute("DELETE FROM students")
        try:
            cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('office_attendance', 'employee_breaks', 'attendance_records', 'employees', 'students')")
        except Exception:
            pass

        # Ensure default admin exists
        cursor.execute("SELECT COUNT(*) FROM admins WHERE username = 'admin'")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO admins (username, password_hash, full_name, role)
                VALUES (?, ?, ?, ?)
            """, ("admin", hash_password("admin123"), "HR Administrator", "admin"))
        else:
            cursor.execute("UPDATE admins SET full_name = 'HR Administrator' WHERE username = 'admin'")

        # Ensure active office branch exists (no default employees)
        seed_default_branch_only(cursor)

        conn.commit()
    return {
        "success": True,
        "message": "System reset complete! All employee records and attendance wiped. Admin (admin / admin123) is ready!"
    }

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
    # Also sync to employees table for office attendance
    try:
        add_employee(
            emp_code=student_id,
            name=name,
            email=email,
            department="Operations",
            designation="Staff Member",
            branch_id=1,
            device_id=device_id,
            face_embedding_json=face_embedding_json,
            password=password
        )
    except Exception as e:
        print(f"Warning: Auto-sync student to employee failed: {e}")
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
# Geofence Zone & Office Branch Operations
# ==========================================

def get_zones(only_active: bool = False) -> List[Dict[str, Any]]:
    """Fetches all or only active office branch geofence zones."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT id, name, latitude, longitude, radius_meters, is_active FROM office_branches"
        if only_active:
            query += " WHERE is_active = 1"
        query += " ORDER BY id ASC"
        cursor.execute(query)
        rows = [dict(r) for r in cursor.fetchall()]
        if not rows:
            cursor.execute("SELECT id, name, latitude, longitude, radius_meters, is_active FROM geofence_zones ORDER BY id ASC")
            rows = [dict(r) for r in cursor.fetchall()]
        return rows


def add_zone(name: str, latitude: float, longitude: float, radius_meters: float = 100.0) -> int:
    """Creates a new office branch geofence zone without static hardcoding."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO office_branches (name, address, latitude, longitude, radius_meters, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (name.strip(), name.strip(), float(latitude), float(longitude), float(radius_meters)))
        b_id = cursor.lastrowid
        try:
            cursor.execute("""
                INSERT INTO geofence_zones (name, latitude, longitude, radius_meters, is_active)
                VALUES (?, ?, ?, ?, 1)
            """, (name.strip(), float(latitude), float(longitude), float(radius_meters)))
        except Exception:
            pass
        conn.commit()
        return b_id


def delete_zone(zone_id: int) -> bool:
    """Removes an office branch geofence zone."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM office_branches WHERE id = ?", (zone_id,))
        try:
            cursor.execute("DELETE FROM geofence_zones WHERE id = ?", (zone_id,))
        except Exception:
            pass
        conn.commit()
        return cursor.rowcount > 0


def get_office_branch(branch_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves an office branch by ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM office_branches WHERE id = ?", (branch_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


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


# ==========================================
# Corporate Office & Employee Operations
# ==========================================

def verify_employee(emp_code: str, password: str) -> Optional[Dict[str, Any]]:
    """Verifies employee credentials and returns employee profile."""
    emp_code = emp_code.strip()
    p_hash = hash_password(password.strip())
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, emp_code, name, email, department, designation, branch_id, device_id, password_hash, is_active, created_at
            FROM employees
            WHERE emp_code = ? AND is_active = 1
        """, (emp_code,))
        row = cursor.fetchone()
        if not row:
            return None
        emp_dict = dict(row)
        # If password hash is set, check match; if empty, allow default password 'office123' or 'student123'
        if emp_dict.get("password_hash"):
            if emp_dict["password_hash"] != p_hash:
                return None
        else:
            default_hashes = [hash_password("office123"), hash_password("student123"), hash_password("admin123")]
            if p_hash not in default_hashes:
                return None
        emp_dict.pop("password_hash", None)
        return emp_dict


def get_employee(emp_code: str) -> Optional[Dict[str, Any]]:
    """Retrieves an active employee record by employee code."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT e.id, e.emp_code, e.name, e.email, e.department, e.designation,
                   e.branch_id, e.device_id, e.face_embedding, e.is_active, e.created_at,
                   b.name as branch_name
            FROM employees e
            LEFT JOIN office_branches b ON e.branch_id = b.id
            WHERE e.emp_code = ? AND e.is_active = 1
        """, (emp_code.strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_employees(only_active: bool = True) -> List[Dict[str, Any]]:
    """Lists all active employees in the organization."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT e.id, e.emp_code, e.name, e.email, e.department, e.designation,
                   e.branch_id, e.device_id, e.is_active, e.created_at,
                   b.name as branch_name
            FROM employees e
            LEFT JOIN office_branches b ON e.branch_id = b.id
        """
        if only_active:
            query += " WHERE e.is_active = 1"
        query += " ORDER BY e.department ASC, e.name ASC"
        cursor.execute(query)
        return [dict(r) for r in cursor.fetchall()]


def add_employee(
    emp_code: str,
    name: str,
    email: Optional[str],
    department: str,
    designation: str,
    branch_id: int,
    device_id: str,
    face_embedding_json: str,
    password: Optional[str] = "office123"
) -> bool:
    """Enrolls a new corporate employee with 128-d biometric embedding and device binding."""
    emp_code = emp_code.strip()
    name = name.strip()
    pwd_hash = hash_password(password.strip()) if password else hash_password("office123")
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO employees (
                emp_code, name, email, department, designation,
                branch_id, device_id, face_embedding, password_hash
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(emp_code) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                department = excluded.department,
                designation = excluded.designation,
                branch_id = excluded.branch_id,
                device_id = excluded.device_id,
                face_embedding = excluded.face_embedding,
                password_hash = excluded.password_hash,
                is_active = 1
        """, (
            emp_code, name, email, department, designation,
            branch_id, device_id, face_embedding_json, pwd_hash
        ))
        conn.commit()
        return True


def delete_employee(emp_code: str) -> bool:
    """Permanently deletes an employee and their records from the organization."""
    emp_code = emp_code.strip()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Delete from employees
        cursor.execute("DELETE FROM employees WHERE emp_code = ? COLLATE NOCASE", (emp_code,))
        emp_deleted = cursor.rowcount > 0
        # Also clean up any legacy student entry
        cursor.execute("DELETE FROM students WHERE student_id = ? COLLATE NOCASE", (emp_code,))
        # Also clean up attendance records & breaks
        cursor.execute("DELETE FROM office_attendance WHERE emp_code = ? COLLATE NOCASE", (emp_code,))
        cursor.execute("DELETE FROM employee_breaks WHERE emp_code = ? COLLATE NOCASE", (emp_code,))
        cursor.execute("DELETE FROM attendance_records WHERE student_id = ? COLLATE NOCASE", (emp_code,))
        conn.commit()
        return emp_deleted or True


def update_employee(
    emp_code: str,
    name: Optional[str] = None,
    email: Optional[str] = None,
    department: Optional[str] = None,
    designation: Optional[str] = None,
    branch_id: Optional[int] = None,
    device_id: Optional[str] = None,
    face_embedding_json: Optional[str] = None,
    password: Optional[str] = None
) -> bool:
    """Updates an existing employee's details, branch allocation, device binding, and optionally biometrics."""
    emp_code = emp_code.strip()
    fields = []
    params = []

    if name is not None and name.strip():
        fields.append("name = ?")
        params.append(name.strip())
    if email is not None:
        fields.append("email = ?")
        params.append(email.strip() if email.strip() else None)
    if department is not None and department.strip():
        fields.append("department = ?")
        params.append(department.strip())
    if designation is not None and designation.strip():
        fields.append("designation = ?")
        params.append(designation.strip())
    if branch_id is not None:
        try:
            fields.append("branch_id = ?")
            params.append(int(branch_id))
        except (ValueError, TypeError):
            pass
    if device_id is not None and device_id.strip():
        fields.append("device_id = ?")
        params.append(device_id.strip())
    if face_embedding_json is not None:
        fields.append("face_embedding = ?")
        params.append(face_embedding_json)
    if password is not None and password.strip():
        fields.append("password_hash = ?")
        params.append(hash_password(password.strip()))

    if not fields:
        return True

    params.append(emp_code)
    query = f"UPDATE employees SET {', '.join(fields)} WHERE emp_code = ? AND is_active = 1"

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        updated = cursor.rowcount > 0

        # Also sync employee names in attendance records
        if name and name.strip():
            cursor.execute("UPDATE office_attendance SET emp_name = ? WHERE emp_code = ?", (name.strip(), emp_code))
            cursor.execute("UPDATE attendance_records SET student_name = ? WHERE student_id = ?", (name.strip(), emp_code))
            cursor.execute("UPDATE students SET name = ? WHERE student_id = ?", (name.strip(), emp_code))

        if device_id and device_id.strip():
            cursor.execute("UPDATE students SET device_id = ? WHERE student_id = ?", (device_id.strip(), emp_code))

        conn.commit()
        return updated


def update_employee_device(emp_code: str, device_id: str) -> bool:
    """Updates physical device ID binding for an employee."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE employees SET device_id = ? WHERE emp_code = ?", (device_id.strip(), emp_code.strip()))
        conn.commit()
        return cursor.rowcount > 0


def list_office_branches(only_active: bool = True) -> List[Dict[str, Any]]:
    """Retrieves all corporate office locations / geofence perimeters."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM office_branches"
        if only_active:
            query += " WHERE is_active = 1"
        query += " ORDER BY name ASC"
        cursor.execute(query)
        return [dict(r) for r in cursor.fetchall()]


def add_office_branch(
    name: str,
    address: str,
    latitude: float,
    longitude: float,
    radius_meters: float = 100.0,
    office_wifi_bssid: Optional[str] = None,
    office_public_ip: Optional[str] = None
) -> int:
    """Registers a new office branch with GPS geofence and optional Wi-Fi BSSID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO office_branches (
                name, address, latitude, longitude, radius_meters,
                office_wifi_bssid, office_public_ip
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            name.strip(), address.strip(), latitude, longitude, radius_meters,
            office_wifi_bssid.strip() if office_wifi_bssid else None,
            office_public_ip.strip() if office_public_ip else None
        ))
        conn.commit()
        return cursor.lastrowid


def delete_office_branch(branch_id: int) -> bool:
    """Deletes an office branch."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE office_branches SET is_active = 0 WHERE id = ?", (branch_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_employee_daily_status(emp_code: str, date_str: Optional[str] = None) -> Dict[str, Any]:
    """Computes today's real-time attendance status, hours inside office, and active state."""
    emp_code = emp_code.strip()
    now_ist = get_now_ist()
    if not date_str:
        date_str = now_ist.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT emp_code, name, department FROM employees WHERE emp_code = ? AND is_active = 1", (emp_code,))
        emp_row = cursor.fetchone()
        if not emp_row:
            return {
                "emp_code": emp_code,
                "exists": False,
                "status": "NOT_FOUND",
                "message": f"Employee '{emp_code}' is not registered."
            }

        cursor.execute("""
            SELECT * FROM office_attendance
            WHERE emp_code = ? AND date = ?
            ORDER BY id DESC LIMIT 1
        """, (emp_code, date_str))
        row = cursor.fetchone()

        # Check if currently on break
        cursor.execute("""
            SELECT * FROM employee_breaks
            WHERE emp_code = ? AND date = ? AND end_time IS NULL
            ORDER BY id DESC LIMIT 1
        """, (emp_code, date_str))
        raw_break = cursor.fetchone()
        open_break = dict(raw_break) if raw_break else None

        if not row:
            return {
                "emp_code": emp_code,
                "date": date_str,
                "is_clocked_in": False,
                "is_clocked_out": False,
                "is_on_break": False,
                "clock_in_time": None,
                "clock_out_time": None,
                "elapsed_seconds": 0,
                "elapsed_formatted": "0h 00m",
                "net_work_hours": 0.0,
                "total_break_minutes": 0,
                "status": "NOT_ARRIVED",
                "message": "Not clocked in yet today."
            }

        rec = dict(row)
        clock_in = datetime.fromisoformat(rec["clock_in_time"]) if rec["clock_in_time"] else None
        clock_out = datetime.fromisoformat(rec["clock_out_time"]) if rec["clock_out_time"] else None

        is_clocked_in = clock_in is not None
        is_clocked_out = clock_out is not None
        is_on_break = open_break is not None

        elapsed_seconds = 0
        if is_clocked_in and not is_clocked_out:
            elapsed_seconds = max(0, int((now_ist - clock_in).total_seconds()))
            # Subtract break minutes so far
            total_breaks_sec = (rec.get("total_break_minutes") or 0) * 60
            if is_on_break and open_break.get("start_time"):
                b_start = datetime.fromisoformat(open_break["start_time"])
                current_break_sec = int((now_ist - b_start).total_seconds())
                total_breaks_sec += current_break_sec
            active_sec = max(0, elapsed_seconds - total_breaks_sec)
            hrs = active_sec // 3600
            mins = (active_sec % 3600) // 60
            elapsed_formatted = f"{hrs}h {mins:02d}m"
            net_hours = round(active_sec / 3600.0, 2)
            current_status = "ON_BREAK" if is_on_break else "IN_OFFICE"
        elif is_clocked_out:
            net_hours = rec.get("net_work_hours") or 0.0
            hrs = int(net_hours)
            mins = int((net_hours - hrs) * 60)
            elapsed_formatted = f"{hrs}h {mins:02d}m"
            current_status = "CLOCKED_OUT"
        else:
            net_hours = 0.0
            elapsed_formatted = "0h 00m"
            current_status = "NOT_ARRIVED"

        return {
            "emp_code": emp_code,
            "emp_name": rec.get("emp_name"),
            "department": rec.get("department"),
            "date": date_str,
            "is_clocked_in": is_clocked_in,
            "is_clocked_out": is_clocked_out,
            "is_on_break": is_on_break,
            "clock_in_time": rec["clock_in_time"],
            "clock_out_time": rec["clock_out_time"],
            "elapsed_seconds": elapsed_seconds,
            "elapsed_formatted": elapsed_formatted,
            "net_work_hours": net_hours,
            "total_break_minutes": rec.get("total_break_minutes") or 0,
            "status": current_status,
            "arrival_status": rec.get("arrival_status", "ON_TIME"),
            "minutes_late": rec.get("minutes_late", 0),
            "is_overtime": rec.get("is_overtime", 0),
            "overtime_hours": rec.get("overtime_hours", 0.0),
            "clock_in_zone_name": rec.get("clock_in_zone_name"),
            "message": rec.get("audit_notes")
        }


def clock_in_employee(
    emp_code: str,
    emp_name: str,
    department: str,
    latitude: float,
    longitude: float,
    device_id: str,
    zone_name: str,
    distance_to_zone: float,
    liveness_score: float = 100.0,
    is_mock: bool = False,
    similarity_score: float = 100.0,
    face_distance: Optional[float] = None
) -> Dict[str, Any]:
    """Records employee morning Clock-In with anti-spoofing and geofence telemetry."""
    now_ist = get_now_ist()
    date_str = now_ist.strftime("%Y-%m-%d")
    clock_in_iso = now_ist.isoformat()

    # Determine arrival punctuality: Expected arrival 09:30 AM IST
    expected_hour = 9
    expected_minute = 30
    current_minutes = now_ist.hour * 60 + now_ist.minute
    expected_total_minutes = expected_hour * 60 + expected_minute

    if current_minutes > expected_total_minutes:
        arrival_status = "LATE"
        minutes_late = current_minutes - expected_total_minutes
    else:
        arrival_status = "ON_TIME"
        minutes_late = 0

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Check if already clocked in today
        cursor.execute("SELECT id, clock_in_time, clock_out_time FROM office_attendance WHERE emp_code = ? AND date = ?", (emp_code, date_str))
        existing = cursor.fetchone()
        if existing:
            if existing["clock_out_time"] is None:
                return {
                    "success": False,
                    "already_clocked_in": True,
                    "message": f"Employee {emp_code} is already clocked in for today at {existing['clock_in_time']}."
                }
            else:
                return {
                    "success": False,
                    "already_clocked_out": True,
                    "message": f"Employee {emp_code} has already completed attendance and clocked out today."
                }

        face_info = f", Biometric: {similarity_score}% (dist: {face_distance:.3f})" if face_distance is not None else f", Biometric: {similarity_score}%"
        notes = f"Clocked in at {now_ist.strftime('%I:%M %p')}. Zone: {zone_name} ({distance_to_zone:.1f}m){face_info}."
        if is_mock:
            notes += " [WARNING: Mock GPS Detected]"

        cursor.execute("""
            INSERT INTO office_attendance (
                emp_code, emp_name, department, date, clock_in_time,
                clock_in_lat, clock_in_lon, clock_in_device_id,
                clock_in_zone_name, clock_in_distance, clock_in_liveness_score,
                is_mock_location, status, arrival_status, minutes_late, audit_notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLOCKED_IN', ?, ?, ?)
        """, (
            emp_code, emp_name, department, date_str, clock_in_iso,
            latitude, longitude, device_id, zone_name, distance_to_zone,
            liveness_score, 1 if is_mock else 0, arrival_status, minutes_late, notes
        ))
        conn.commit()
        return {
            "success": True,
            "status": "CLOCKED_IN",
            "clock_in_time": clock_in_iso,
            "arrival_status": arrival_status,
            "minutes_late": minutes_late,
            "zone_name": zone_name,
            "message": f"Welcome, {emp_name}! Clocked in successfully at {now_ist.strftime('%I:%M %p')}."
        }


def clock_out_employee(
    emp_code: str,
    latitude: float,
    longitude: float,
    device_id: str,
    zone_name: str,
    distance_to_zone: float,
    liveness_score: float = 100.0,
    is_mock: bool = False
) -> Dict[str, Any]:
    """Records employee evening Clock-Out, closes active breaks, and computes total net working hours."""
    now_ist = get_now_ist()
    date_str = now_ist.strftime("%Y-%m-%d")
    clock_out_iso = now_ist.isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM office_attendance
            WHERE emp_code = ? AND date = ? AND clock_out_time IS NULL
            ORDER BY id DESC LIMIT 1
        """, (emp_code, date_str))
        row = cursor.fetchone()

        if not row:
            # Check if already clocked out
            cursor.execute("SELECT clock_out_time, net_work_hours FROM office_attendance WHERE emp_code = ? AND date = ?", (emp_code, date_str))
            done = cursor.fetchone()
            if done and done["clock_out_time"]:
                return {
                    "success": False,
                    "message": f"Already clocked out at {done['clock_out_time']} (Logged {done['net_work_hours']} hours today)."
                }
            return {
                "success": False,
                "message": "Cannot clock out: No active clock-in found for today. Please clock in first."
            }

        rec = dict(row)
        clock_in_dt = datetime.fromisoformat(rec["clock_in_time"])

        # 1. Close any open break
        cursor.execute("""
            SELECT id, start_time FROM employee_breaks
            WHERE emp_code = ? AND date = ? AND end_time IS NULL
        """, (emp_code, date_str))
        open_break = cursor.fetchone()
        if open_break:
            b_start = datetime.fromisoformat(open_break["start_time"])
            b_duration = max(1, int((now_ist - b_start).total_seconds() / 60))
            cursor.execute("""
                UPDATE employee_breaks
                SET end_time = ?, duration_minutes = ?
                WHERE id = ?
            """, (clock_out_iso, b_duration, open_break["id"]))

        # 2. Sum all break durations for today
        cursor.execute("SELECT SUM(duration_minutes) FROM employee_breaks WHERE emp_code = ? AND date = ?", (emp_code, date_str))
        total_break_mins = cursor.fetchone()[0] or 0

        # 3. Compute Gross & Net Hours inside office
        gross_seconds = max(0, int((now_ist - clock_in_dt).total_seconds()))
        net_seconds = max(0, gross_seconds - (total_break_mins * 60))
        net_work_hours = round(net_seconds / 3600.0, 2)

        # 4. Determine Overtime (Standard workday = 8.0 hours)
        is_overtime = 1 if net_work_hours > 8.0 else 0
        overtime_hours = round(max(0.0, net_work_hours - 8.0), 2)

        notes = f"Clocked out at {now_ist.strftime('%I:%M %p')}. Net Work Hours: {net_work_hours} hrs (Break: {total_break_mins} mins)."
        if is_overtime:
            notes += f" [Overtime: +{overtime_hours} hrs]"

        cursor.execute("""
            UPDATE office_attendance
            SET clock_out_time = ?,
                clock_out_lat = ?,
                clock_out_lon = ?,
                clock_out_device_id = ?,
                clock_out_zone_name = ?,
                clock_out_distance = ?,
                clock_out_liveness_score = ?,
                total_break_minutes = ?,
                net_work_hours = ?,
                is_overtime = ?,
                overtime_hours = ?,
                status = 'COMPLETED',
                audit_notes = audit_notes || ' | ' || ?
            WHERE id = ?
        """, (
            clock_out_iso, latitude, longitude, device_id, zone_name,
            distance_to_zone, liveness_score, total_break_mins, net_work_hours,
            is_overtime, overtime_hours, notes, rec["id"]
        ))
        conn.commit()

        hrs = int(net_work_hours)
        mins = int((net_work_hours - hrs) * 60)

        return {
            "success": True,
            "status": "COMPLETED",
            "clock_in_time": rec["clock_in_time"],
            "clock_out_time": clock_out_iso,
            "total_break_minutes": total_break_mins,
            "net_work_hours": net_work_hours,
            "work_duration_formatted": f"{hrs}h {mins:02d}m",
            "is_overtime": is_overtime == 1,
            "overtime_hours": overtime_hours,
            "message": f"Clock-Out recorded! You worked {hrs} hours and {mins} minutes today. Great job!"
        }


def start_employee_break(emp_code: str, break_type: str = "LUNCH") -> Dict[str, Any]:
    """Starts an employee break (e.g. Lunch or Tea break)."""
    now_ist = get_now_ist()
    date_str = now_ist.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Verify employee is clocked in
        cursor.execute("SELECT id FROM office_attendance WHERE emp_code = ? AND date = ? AND clock_out_time IS NULL", (emp_code, date_str))
        if not cursor.fetchone():
            return {"success": False, "message": "Cannot start break: Employee is not currently clocked in."}

        # Check if already on break
        cursor.execute("SELECT id FROM employee_breaks WHERE emp_code = ? AND date = ? AND end_time IS NULL", (emp_code, date_str))
        if cursor.fetchone():
            return {"success": False, "message": "You are already on an active break."}

        cursor.execute("""
            INSERT INTO employee_breaks (emp_code, date, break_type, start_time)
            VALUES (?, ?, ?, ?)
        """, (emp_code, date_str, break_type.upper(), now_ist.isoformat()))
        conn.commit()

        return {
            "success": True,
            "status": "ON_BREAK",
            "break_type": break_type.upper(),
            "start_time": now_ist.isoformat(),
            "message": f"{break_type.capitalize()} break started at {now_ist.strftime('%I:%M %p')}."
        }


def end_employee_break(emp_code: str) -> Dict[str, Any]:
    """Ends current break and records duration in minutes."""
    now_ist = get_now_ist()
    date_str = now_ist.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, break_type, start_time FROM employee_breaks
            WHERE emp_code = ? AND date = ? AND end_time IS NULL
            ORDER BY id DESC LIMIT 1
        """, (emp_code, date_str))
        open_b = cursor.fetchone()

        if not open_b:
            return {"success": False, "message": "No active break found to end."}

        start_dt = datetime.fromisoformat(open_b["start_time"])
        duration_mins = max(1, int((now_ist - start_dt).total_seconds() / 60))

        cursor.execute("""
            UPDATE employee_breaks
            SET end_time = ?, duration_minutes = ?
            WHERE id = ?
        """, (now_ist.isoformat(), duration_mins, open_b["id"]))

        # Update attendance total break minutes
        cursor.execute("SELECT SUM(duration_minutes) FROM employee_breaks WHERE emp_code = ? AND date = ?", (emp_code, date_str))
        total_breaks = cursor.fetchone()[0] or 0

        cursor.execute("UPDATE office_attendance SET total_break_minutes = ? WHERE emp_code = ? AND date = ?", (total_breaks, emp_code, date_str))
        conn.commit()

        return {
            "success": True,
            "status": "IN_OFFICE",
            "break_type": open_b["break_type"],
            "duration_minutes": duration_mins,
            "total_break_minutes": total_breaks,
            "message": f"Break ended. Duration: {duration_mins} mins. Welcome back to work!"
        }


def get_today_office_radar() -> List[Dict[str, Any]]:
    """Returns real-time status of all corporate employees today for HR Dashboard."""
    now_ist = get_now_ist()
    date_str = now_ist.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT e.emp_code, e.name, e.department, e.designation,
                   b.name as branch_name,
                   a.clock_in_time, a.clock_out_time, a.total_break_minutes,
                   a.net_work_hours, a.arrival_status, a.minutes_late,
                   a.clock_in_zone_name, a.clock_in_distance, a.is_overtime,
                   a.status as raw_status
            FROM employees e
            LEFT JOIN office_branches b ON e.branch_id = b.id
            LEFT JOIN office_attendance a ON e.emp_code = a.emp_code AND a.date = ?
            WHERE e.is_active = 1
            ORDER BY
                CASE
                    WHEN a.clock_in_time IS NOT NULL AND a.clock_out_time IS NULL THEN 1
                    WHEN a.clock_out_time IS NOT NULL THEN 2
                    ELSE 3
                END,
                e.name ASC
        """, (date_str,))
        rows = [dict(r) for r in cursor.fetchall()]

        # Query active breaks
        cursor.execute("SELECT emp_code FROM employee_breaks WHERE date = ? AND end_time IS NULL", (date_str,))
        breaks_set = {r["emp_code"] for r in cursor.fetchall()}

        radar = []
        for r in rows:
            clock_in = datetime.fromisoformat(r["clock_in_time"]) if r.get("clock_in_time") else None
            clock_out = datetime.fromisoformat(r["clock_out_time"]) if r.get("clock_out_time") else None

            if clock_in and not clock_out:
                on_break = r["emp_code"] in breaks_set
                elapsed = max(0, int((now_ist - clock_in).total_seconds()))
                break_sec = (r.get("total_break_minutes") or 0) * 60
                active_sec = max(0, elapsed - break_sec)
                hrs = active_sec // 3600
                mins = (active_sec % 3600) // 60
                r["live_hours_formatted"] = f"{hrs}h {mins:02d}m"
                r["net_hours_float"] = round(active_sec / 3600.0, 2)
                r["presence_status"] = "ON_BREAK" if on_break else "IN_OFFICE"
            elif clock_out:
                net = r.get("net_work_hours") or 0.0
                hrs = int(net)
                mins = int((net - hrs) * 60)
                r["live_hours_formatted"] = f"{hrs}h {mins:02d}m"
                r["net_hours_float"] = net
                r["presence_status"] = "CLOCKED_OUT"
            else:
                r["live_hours_formatted"] = "0h 00m"
                r["net_hours_float"] = 0.0
                r["presence_status"] = "ABSENT"

            radar.append(r)
        return radar


def get_office_timesheets(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    emp_code: Optional[str] = None,
    department: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieves full timesheet records for payroll processing and auditing."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        query = """
            SELECT a.*, e.designation, b.name as branch_name
            FROM office_attendance a
            JOIN employees e ON a.emp_code = e.emp_code
            LEFT JOIN office_branches b ON e.branch_id = b.id
            WHERE 1=1
        """
        params = []
        if start_date:
            query += " AND a.date >= ?"
            params.append(start_date)
        if end_date:
            query += " AND a.date <= ?"
            params.append(end_date)
        if emp_code:
            query += " AND a.emp_code = ?"
            params.append(emp_code.strip())
        if department and department != "ALL":
            query += " AND a.department = ?"
            params.append(department.strip())

        query += " ORDER BY a.date DESC, a.clock_in_time DESC"
        cursor.execute(query, params)
        return [dict(r) for r in cursor.fetchall()]


def get_office_stats() -> Dict[str, Any]:
    """Returns corporate office metrics for HR Dashboard."""
    now_ist = get_now_ist()
    date_str = now_ist.strftime("%Y-%m-%d")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM employees WHERE is_active = 1")
        total_employees = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM office_branches WHERE is_active = 1")
        total_branches = cursor.fetchone()[0]

        # Employees currently in office today (clocked in, not clocked out)
        cursor.execute("""
            SELECT COUNT(*) FROM office_attendance
            WHERE date = ? AND clock_in_time IS NOT NULL AND clock_out_time IS NULL
        """, (date_str,))
        currently_in_office = cursor.fetchone()[0]

        # On active break
        cursor.execute("SELECT COUNT(DISTINCT emp_code) FROM employee_breaks WHERE date = ? AND end_time IS NULL", (date_str,))
        currently_on_break = cursor.fetchone()[0]

        # Clocked out today
        cursor.execute("SELECT COUNT(*) FROM office_attendance WHERE date = ? AND clock_out_time IS NOT NULL", (date_str,))
        clocked_out_today = cursor.fetchone()[0]

        # Late arrivals today
        cursor.execute("SELECT COUNT(*) FROM office_attendance WHERE date = ? AND arrival_status = 'LATE'", (date_str,))
        late_today = cursor.fetchone()[0]

        # Overtime today
        cursor.execute("SELECT COUNT(*) FROM office_attendance WHERE date = ? AND is_overtime = 1", (date_str,))
        overtime_today = cursor.fetchone()[0]

        return {
            "total_employees": total_employees,
            "total_branches": total_branches,
            "currently_in_office": currently_in_office,
            "currently_on_break": currently_on_break,
            "clocked_out_today": clocked_out_today,
            "late_today": late_today,
            "overtime_today": overtime_today,
            "date": date_str,
            "server_time": now_ist.strftime("%I:%M:%S %p")
        }



def delete_timesheet_record(timesheet_id: int) -> bool:
    """Deletes a specific office attendance timesheet record and associated breaks."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT emp_code, date FROM office_attendance WHERE id = ?", (timesheet_id,))
        row = cursor.fetchone()
        if row:
            emp_code, date_val = row["emp_code"], row["date"]
            cursor.execute("DELETE FROM employee_breaks WHERE emp_code = ? AND date = ?", (emp_code, date_val))
            cursor.execute("DELETE FROM attendance_records WHERE student_id = ? AND attendance_date = ?", (emp_code, date_val))
        cursor.execute("DELETE FROM office_attendance WHERE id = ?", (timesheet_id,))
        conn.commit()
        return cursor.rowcount > 0


def delete_attendance_audit_record(record_id: int) -> bool:
    """Deletes a specific raw attendance audit log."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM attendance_records WHERE id = ?", (record_id,))
        conn.commit()
        return cursor.rowcount > 0


def reset_employee_attendance(emp_code: str) -> bool:
    """Resets/clears all timesheets, punches, and breaks for a single employee without deleting their account."""
    emp_code = emp_code.strip()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM office_attendance WHERE emp_code = ?", (emp_code,))
        cursor.execute("DELETE FROM employee_breaks WHERE emp_code = ?", (emp_code,))
        cursor.execute("DELETE FROM attendance_records WHERE student_id = ?", (emp_code,))
        conn.commit()
        return True

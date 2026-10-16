# Smart Attendance System with 128-d Face Recognition & GPS Geofencing 🎓🛡️

A state-of-the-art automated attendance tracking solution combining **Facial Biometrics (128-dimensional embedding verification)**, **GPS Geofencing (Haversine formula)**, and **Anti-Proxy Device Binding** for educational institutions and organizations.

---

## 🌟 Key Features

* **Facial Biometrics**:
  * 128-dimensional Euclidean distance face embedding comparison via `dlib` & `face_recognition`.
  * **Zero Raw Photo Storage**: In-memory vectorization ensures student biometric privacy.
  * Multi-metric Anti-Spoofing & Presentation Attack Detection (texture variance, frequency, reflection checks).
* **Classroom GPS Geofencing**:
  * Mathematical distance verification to designated lecture halls/zones via Haversine formula.
  * Real-time distance calculation in meters.
* **Anti-Proxy Device Binding**:
  * Locks student enrollment to unique physical hardware IDs (`DEV-XXXX`).
* **Multi-Portal Architecture**:
  * **FastAPI Python Backend**: High-performance asynchronous REST API with SQLite audit database.
  * **Interactive Web Admin Dashboard**: Live student management, geofence radius adjustment, and CSV export.
  * **Cross-Platform Mobile App (React Native / Expo)**: Student check-in with camera HUD & 8-hour period timetable breakdown.

---

## 🏗️ Project Structure

```text
├── render.yaml                          # Render.com Cloud deployment blueprint
├── run_backend.bat                      # 1-Click launcher for FastAPI backend
├── run_mobile_app.bat                   # 1-Click launcher for Expo React Native
├── run_live_internet_tunnel.bat         # 1-Click free HTTPS public tunnel via Cloudflare
├── .gitignore                           # Excludes venv, node_modules, binaries
└── attendance-project/
    ├── backend/                         # FastAPI Python Backend
    │   ├── main.py                      # REST API endpoints & route handlers
    │   ├── database.py                  # SQLite schema & queries
    │   ├── face_utils.py                # 128-d facial embedding extraction
    │   ├── geo_utils.py                 # Haversine GPS distance algorithms
    │   ├── anti_spoofing.py             # Liveness & anti-spoofing checks
    │   ├── requirements.txt             # Python dependencies
    │   ├── Dockerfile                   # Docker container configuration
    │   └── static/                      # Web Admin Dashboard (HTML/CSS/JS)
    └── mobile_app_rn/                   # React Native Expo Mobile App
        ├── App.js                       # Main application shell & tab routing
        ├── app.json                     # Expo configuration (permissions, plugins)
        ├── eas.json                     # Standalone APK cloud build configuration
        ├── package.json                 # React Native dependencies
        ├── assets/                      # App icons & branding
        └── src/
            ├── components/              # UI Components (ResultModal, CameraModal, Header)
            ├── constants/               # Colors, themes, and backend IP presets
            ├── screens/                 # CheckIn, Students, History, Settings, Login
            └── utils/                   # Location & network helpers
```

---

## 🚀 Quick Start (Local)

### 1. Backend (FastAPI)
```powershell
cd attendance-project/backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
.\venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
* **Web Dashboard**: http://localhost:8000
* **API Documentation**: http://localhost:8000/docs

### 2. Mobile App (Expo React Native)
```powershell
cd attendance-project/mobile_app_rn
npm install
npx expo start
```

---

## ☁️ Deployment

### Free 24/7 Cloud Deployment on Render
1. Connect this GitHub repository to [Render.com](https://render.com).
2. Create a new **Web Service**.
3. Select **Python 3**, set Root Directory to `attendance-project/backend`.
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Standalone Android APK (.apk)
```powershell
cd attendance-project/mobile_app_rn
npx eas build -p android --profile preview
```

---

## 📄 License
MIT License

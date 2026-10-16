# Smart Attendance - React Native (Expo) Mobile App

This is the **React Native / Expo** mobile client for the Smart Attendance System.

---

## ⚡ Why React Native / Expo?

* **No Android Studio or Xcode required:** You don't need gigabytes of SDKs, emulators, or complex build tools.
* **Instant Physical Device Testing:** Scan a QR code using the free **Expo Go** app on your real Android phone or iPhone, and the app runs immediately with access to your real camera and real GPS hardware!
* **Multi-Factor Verification:** Includes live camera selfie capture, GPS Haversine geofencing, hardware device ID binding, and anti-spoofing diagnostics.

---

## 🚀 Quick Setup (3 Minutes)

### Step 1: Install Dependencies
Open PowerShell or your terminal in this directory:
```bash
cd "d:\Smart Attendance App with Face Recognition and GPS\attendance-project\mobile_app_rn"
npm install
```

### Step 2: Start the Expo Development Server
```bash
npx expo start
```
A large QR code will appear directly in your terminal window!

### Step 3: Run on Your Physical Phone
1. Install **Expo Go** on your smartphone:
   * **Android:** [Download on Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   * **iPhone:** [Download on Apple App Store](https://apps.apple.com/app/expo-go/id982107779)
2. Open **Expo Go** and tap **"Scan QR Code"** (on iPhone, use the default iOS Camera app).
3. The app will immediately load on your phone!

---

## 📡 Connecting to the FastAPI Backend

1. Make sure your computer and phone are connected to the **same Wi-Fi network**.
2. Find your computer's local Wi-Fi IP address (run `ipconfig` in PowerShell $\rightarrow$ look for IPv4 Address, e.g. `192.168.1.100`).
3. Ensure the backend server is running with `--host 0.0.0.0`:
   ```bash
   cd "d:\Smart Attendance App with Face Recognition and GPS\attendance-project\backend"
   .\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```
4. In the mobile app on your phone, tap the **Settings** tab (gear icon at bottom right).
5. Enter your computer's IP: `http://192.168.1.100:8000` (replace with your actual IP) and tap **"Test Connection"**.
6. You're ready to verify attendance with real facial biometrics and GPS geofencing!

---

## 📱 App Tabs & Features

* **📷 Verify (Check-In):** Live camera viewfinder with face oval guide, auto GPS coordinates, student selector, and live 4-factor modal result HUD (Device ID, GPS Geofence, Biometric Match %, Anti-Spoofing Liveness).
* **👥 Students (Enrollment):** Register new students, take reference facial photos, and bind hardware signatures.
* **📜 Logs (History):** Live attendance audit logs with real-time pass/fail badges.
* **⚙️ Settings:** Backend IP configuration, connectivity ping, and unique device hardware signature view.

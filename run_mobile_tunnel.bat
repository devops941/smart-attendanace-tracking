@echo off
title Smart Attendance Mobile (Expo Universal Tunnel)
echo ==============================================================
echo   Starting Expo Mobile Bundler in TUNNEL MODE
echo   Works on 4G, 5G, and any Wi-Fi network!
echo ==============================================================
cd /d "%~dp0attendance-project\mobile_app_rn"
npx expo start --tunnel -c
pause

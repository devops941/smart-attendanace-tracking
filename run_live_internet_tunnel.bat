@echo off
title Smart Attendance - Free Public Live Tunnel
echo ==============================================================
echo   Generating 100%% Free HTTPS Public Live URL via Cloudflare
echo ==============================================================
echo.
echo Make sure your backend (run_backend.bat) is running on port 8000!
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8000
pause

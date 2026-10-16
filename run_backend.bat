@echo off
title Smart Attendance Backend (FastAPI)
echo ==============================================================
echo  Starting Smart Attendance Backend on http://0.0.0.0:8000
echo ==============================================================
cd /d "%~dp0attendance-project\backend"
".\venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause

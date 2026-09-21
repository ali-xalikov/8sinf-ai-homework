@echo off
rem ============================================================
rem  8-sinf AI Homework - ishga tushirish (Windows)
rem  Birinchi marta:  start.bat --setup
rem  Keyin:           start.bat
rem ============================================================
cd /d "%~dp0"

if "%1"=="--setup" (
  echo Python talablari o'rnatilmoqda...
  python -m pip install -r backend\requirements.txt
  echo.
  echo O'rnatish tugadi. Endi start.bat buyurug'ini bering.
  pause
  exit /b
)

where python >nul 2>nul
if errorlevel 1 (
  echo Python topilmadi. python.org saytidan Python 3.11+ o'rnating.
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example copy .env.example .env >nul
  echo .
  echo .env fayli tayyor. Xohlasangiz OPENAI_API_KEY yoki Ollama sozlang.
)

python run.py
pause
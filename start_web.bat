@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MediaPrag-Analytics

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js topilmadi. https://nodejs.org dan Node.js 24 ni o'rnating.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [MediaPrag] Kutubxonalar o'rnatilmoqda...
    call npm install
)
if not exist ".next\BUILD_ID" (
    echo [MediaPrag] Ilova yig'ilmoqda - bu bir martalik jarayon...
    call npm run build
)

rem Baza: .env.local dagi DATABASE_URL (Supabase) yoki kompyuterdagi PGlite (datapglite)
echo.
echo [MediaPrag] Platforma: http://localhost:3100
echo [MediaPrag] To'xtatish uchun shu oynani yoping yoki Ctrl+C bosing.
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3100"
call npx next start -p 3100 -H 127.0.0.1
pause

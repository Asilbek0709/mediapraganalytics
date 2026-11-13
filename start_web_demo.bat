@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MediaPrag-Analytics (DEMO)

if not exist "data\demo.db" (
    echo Demo baza topilmadi: data\demo.db
    pause
    exit /b 1
)
set "MEDIAPRAG_DB=%~dp0data\demo.db"
if not exist "node_modules" call npm install
if not exist ".next\BUILD_ID" call npm run build

echo [MediaPrag] DEMO rejim: http://localhost:3101
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3101"
call npx next start -p 3101 -H 127.0.0.1
pause

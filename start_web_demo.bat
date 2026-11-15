@echo off
chcp 65001 >nul
cd /d "%~dp0"
title MediaPrag-Analytics (DEMO)

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js topilmadi. https://nodejs.org dan Node.js 24 ni o'rnating.
    pause
    exit /b 1
)
if not exist "node_modules" call npm install
if not exist ".next\BUILD_ID" call npm run build

set "MEDIAPRAG_DB=%~dp0data\demo-pglite"
if not exist "data\demo-pglite" (
    if not exist "data\demo.db" (
        echo Demo baza topilmadi: data\demo.db
        pause
        exit /b 1
    )
    echo [MediaPrag] Demo ma'lumotlar data\demo.db dan ko'chirilmoqda...
    call npm run import:sqlite -- data\demo.db
)

echo [MediaPrag] DEMO rejim: http://localhost:3101
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3101"
call npx next start -p 3101 -H 127.0.0.1
pause

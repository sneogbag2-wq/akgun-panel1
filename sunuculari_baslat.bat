@echo off
title AKGUN Panel - Sunucu Baslatici

echo ===================================================
echo   AKGUN Panel Sunuculari Baslatiliyor...
echo ===================================================
echo.

echo [1/2] Backend Sunucusu baslatiliyor (Port 3001)...
start "AKGUN Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

echo [2/2] Frontend Vite Dev Server baslatiliyor (Port 5173)...
start "AKGUN Frontend" cmd /k "cd /d "%~dp0panel" && npm run dev"

echo.
echo ===================================================
echo   Iki sunucu da ayri pencerelerde baslatildi!
echo   - Frontend: http://localhost:5173
echo   - Backend:  http://localhost:3001
echo ===================================================
echo.
timeout /t 3 >nul

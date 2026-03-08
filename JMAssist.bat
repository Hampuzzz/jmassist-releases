@echo off
chcp 65001 >nul 2>&1
title JM Assist v1.2

:: Use the directory where this bat file is located
cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo  [!] Beroenden saknas. Kor "Installera-JMAssist.bat" forst!
    echo  Eller kor: npm install
    echo.
    pause
    exit /b 1
)

:: Check if Node.js is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [FEL] Node.js hittades inte!
    echo  Kor "Installera-JMAssist.bat" for att installera.
    echo.
    pause
    exit /b 1
)

echo.
echo  Startar JM Assist v1.2...
echo  (Stang inte detta fonster)
echo.

:: Start Electron from project root (package.json has "main": "electron/main.js")
npx electron .
@echo off
chcp 65001 >nul 2>&1
title JM Assist - Installation
color 0A

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║           JM Assist - Installation           ║
echo  ║          Verkstads-ERP av JM Trading         ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ─── Check if running as admin (needed for Node.js install) ───
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Startar om som administratör...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: ─── Set install directory ───
set "INSTALL_DIR=%~dp0"
cd /d "%INSTALL_DIR%"

echo  [1/4] Kontrollerar Node.js...
echo.

:: ─── Check if Node.js is installed ───
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Node.js hittades inte. Installerar...
    echo.
    call :install_nodejs
) else (
    for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
    echo  [OK] Node.js %NODE_VER% hittad.
)
echo.

:: ─── Verify node works after install ───
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FEL] Node.js kunde inte installeras.
    echo  Installera manuellt fran: https://nodejs.org
    echo  Valj "LTS" versionen och kör denna fil igen.
    pause
    exit /b 1
)

:: ─── Check npm ───
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FEL] npm hittades inte trots att Node.js är installerat.
    echo  Starta om datorn och kör denna fil igen.
    pause
    exit /b 1
)

echo  [2/4] Installerar beroenden (npm install)...
echo  Detta kan ta några minuter vid första körning...
echo.

:: ─── Run npm install ───
call npm install --prefer-offline 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [!] npm install hade problem. Försöker igen...
    call npm install 2>&1
)

echo.
echo  [3/4] Skapar genväg på skrivbordet...
echo.

:: ─── Create desktop shortcut ───
powershell -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $shortcut = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'JM Assist.lnk')); ^
   $shortcut.TargetPath = '%INSTALL_DIR%JMAssist.bat'; ^
   $shortcut.WorkingDirectory = '%INSTALL_DIR%'; ^
   $shortcut.IconLocation = '%INSTALL_DIR%public\favicon.ico,0'; ^
   $shortcut.Description = 'JM Assist - Verkstads-ERP'; ^
   $shortcut.WindowStyle = 7; ^
   $shortcut.Save(); ^
   Write-Host '  [OK] Genväg skapad: JM Assist (skrivbordet)'"

echo.
echo  [4/4] Installation klar!
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║         Installation slutförd!               ║
echo  ║                                              ║
echo  ║  Starta appen:                               ║
echo  ║    - Dubbelklicka "JM Assist" på skrivbordet ║
echo  ║    - Eller kör JMAssist.bat                  ║
echo  ║                                              ║
echo  ║  Inloggning:                                 ║
echo  ║    Email:    admin@jmassist.se               ║
echo  ║    Lösenord: JMAssist2026!                   ║
echo  ╚══════════════════════════════════════════════╝
echo.

set /p START_NOW="  Vill du starta JM Assist nu? (J/N): "
if /i "%START_NOW%"=="J" (
    echo.
    echo  Startar JM Assist...
    start "" "%INSTALL_DIR%JMAssist.bat"
)

exit /b 0

:: ═══════════════════════════════════════════════════
:: Function: Install Node.js
:: ═══════════════════════════════════════════════════
:install_nodejs
echo  Laddar ner Node.js 22 LTS...

:: Download Node.js MSI installer
set "NODE_MSI=%TEMP%\node-setup.msi"
powershell -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^
   $url = 'https://nodejs.org/dist/v22.17.0/node-v22.17.0-x64.msi'; ^
   Write-Host '  Laddar ner fran nodejs.org...'; ^
   Invoke-WebRequest -Uri $url -OutFile '%NODE_MSI%' -UseBasicParsing; ^
   if (Test-Path '%NODE_MSI%') { Write-Host '  [OK] Nedladdning klar.' } ^
   else { Write-Host '  [FEL] Nedladdning misslyckades.'; exit 1 }"

if not exist "%NODE_MSI%" (
    echo  [FEL] Kunde inte ladda ner Node.js.
    echo  Installera manuellt: https://nodejs.org
    goto :eof
)

echo  Installerar Node.js (detta kan ta en minut)...
msiexec /i "%NODE_MSI%" /qn /norestart ADDLOCAL=ALL
if %errorlevel% neq 0 (
    echo  [!] Tyst installation misslyckades, öppnar installationsguiden...
    msiexec /i "%NODE_MSI%"
)

:: Refresh PATH so node/npm are found
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"

:: Clean up
del "%NODE_MSI%" >nul 2>&1

:: Verify
where node >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%v in ('node --version') do echo  [OK] Node.js %%v installerad!
) else (
    echo  [!] Node.js installerades men hittades inte i PATH.
    echo  Starta om datorn och kör denna fil igen.
)
goto :eof

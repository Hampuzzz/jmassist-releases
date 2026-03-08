@echo off
:: Run as Administrator to add JMAssist.local to hosts file
echo Adding JMAssist.local to Windows hosts file...
echo.

findstr /C:"jmassist.local" %SystemRoot%\System32\drivers\etc\hosts >nul 2>&1
if %errorlevel% equ 0 (
    echo JMAssist.local already exists in hosts file.
) else (
    echo 127.0.0.1    jmassist.local >> %SystemRoot%\System32\drivers\etc\hosts
    echo ::1          jmassist.local >> %SystemRoot%\System32\drivers\etc\hosts
    echo Added JMAssist.local to hosts file.
)

echo.
echo You can now access the site at: http://jmassist.local:3000
echo.
pause

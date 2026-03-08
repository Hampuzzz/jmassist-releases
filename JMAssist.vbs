Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "G:\ADOFF"

' Start Next.js dev server in background (hidden window)
WshShell.Run "cmd /c cd /d ""G:\ADOFF"" && npm run dev", 0, False

' Start Vehicle Lookup Service in background (hidden window)
WshShell.Run "cmd /c cd /d ""G:\ADOFF"" && npm run lookup", 0, False

' Wait for Next.js server to be ready
WScript.Sleep 4000

' Launch Electron app (visible window)
WshShell.Run "cmd /c cd /d ""G:\ADOFF"" && npx electron .", 0, False

#Requires -RunAsAdministrator
<#
.SYNOPSIS
    JM Assist — Bosgame Workshop PC Setup Script
.DESCRIPTION
    Installs Node.js 20, Git, OpenSSH Server, and configures
    JM Assist on the Bosgame workstation (192.168.68.71).
    Run as Administrator on the Bosgame PC.
.NOTES
    Version: 1.0
    Date: 2026-02-27
#>

param(
    [string]$InstallPath = "C:\JMAssist",
    [switch]$SkipNodeInstall,
    [switch]$SkipGitInstall,
    [switch]$SkipSSH
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# --- Colors ---
function Write-Step($msg) { Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "   WARN: $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "   ERROR: $msg" -ForegroundColor Red }

Write-Host @"

  ============================================
   JM Assist - Bosgame Workshop Setup
   Target: $InstallPath
  ============================================

"@ -ForegroundColor Yellow

# ============================================================
# 1. CHECK PREREQUISITES
# ============================================================
Write-Step "Checking prerequisites..."

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Err "This script must be run as Administrator!"
    Write-Host "Right-click PowerShell -> Run as Administrator"
    exit 1
}
Write-Ok "Running as Administrator"

# Check internet connectivity
try {
    $null = Test-NetConnection -ComputerName "google.com" -Port 443 -InformationLevel Quiet -ErrorAction Stop
    Write-Ok "Internet connection available"
} catch {
    Write-Err "No internet connection. Please connect to the network first."
    exit 1
}

# ============================================================
# 2. INSTALL NODE.JS 20 LTS
# ============================================================
if (-not $SkipNodeInstall) {
    Write-Step "Installing Node.js 20 LTS..."

    $nodeVersion = $null
    try { $nodeVersion = node --version 2>$null } catch {}

    if ($nodeVersion -and $nodeVersion -match "^v(2[0-9]|[3-9])") {
        Write-Ok "Node.js already installed: $nodeVersion"
    } else {
        Write-Host "   Downloading Node.js 20 LTS installer..."
        $nodeUrl = "https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi"
        $nodeInstaller = "$env:TEMP\node-v20-x64.msi"
        Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing

        Write-Host "   Installing Node.js (this may take a minute)..."
        Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn /norestart" -Wait -NoNewWindow
        Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Ok "Node.js installed: $nodeVersion"
        } else {
            Write-Err "Node.js installation failed. Try installing manually from https://nodejs.org"
            exit 1
        }
    }

    # Verify npm
    $npmVersion = npm --version 2>$null
    Write-Ok "npm version: $npmVersion"
} else {
    Write-Warn "Skipping Node.js install (--SkipNodeInstall)"
}

# ============================================================
# 3. INSTALL GIT
# ============================================================
if (-not $SkipGitInstall) {
    Write-Step "Installing Git..."

    $gitVersion = $null
    try { $gitVersion = git --version 2>$null } catch {}

    if ($gitVersion) {
        Write-Ok "Git already installed: $gitVersion"
    } else {
        Write-Host "   Downloading Git installer..."
        $gitUrl = "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe"
        $gitInstaller = "$env:TEMP\Git-installer.exe"
        Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing

        Write-Host "   Installing Git (silent)..."
        Start-Process $gitInstaller -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS=icons,ext\reg\shellhere,assoc,assoc_sh" -Wait -NoNewWindow
        Remove-Item $gitInstaller -Force -ErrorAction SilentlyContinue

        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

        $gitVersion = git --version 2>$null
        if ($gitVersion) {
            Write-Ok "Git installed: $gitVersion"
        } else {
            Write-Warn "Git may need a restart to be available. Continuing..."
        }
    }
} else {
    Write-Warn "Skipping Git install (--SkipGitInstall)"
}

# ============================================================
# 4. ENABLE OPENSSH SERVER
# ============================================================
if (-not $SkipSSH) {
    Write-Step "Enabling OpenSSH Server..."

    $sshCapability = Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'
    if ($sshCapability.State -eq 'Installed') {
        Write-Ok "OpenSSH Server already installed"
    } else {
        Write-Host "   Installing OpenSSH Server..."
        Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
        Write-Ok "OpenSSH Server installed"
    }

    # Start and enable SSH service
    Set-Service -Name sshd -StartupType Automatic
    Start-Service sshd -ErrorAction SilentlyContinue
    Write-Ok "SSH service started and set to auto-start"

    # Firewall rule
    $existingRule = Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue
    if (-not $existingRule) {
        New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -DisplayName "OpenSSH Server (sshd)" `
            -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
        Write-Ok "Firewall rule created for SSH (port 22)"
    } else {
        Write-Ok "SSH firewall rule already exists"
    }
} else {
    Write-Warn "Skipping SSH setup (--SkipSSH)"
}

# ============================================================
# 5. CONFIGURE FIREWALL FOR JM ASSIST (PORT 3000)
# ============================================================
Write-Step "Configuring firewall for JM Assist..."

$existingRule = Get-NetFirewallRule -Name "JMAssist-HTTP-In" -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -Name "JMAssist-HTTP-In" -DisplayName "JM Assist Web (port 3000)" `
        -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 3000 `
        -RemoteAddress 192.168.68.0/24
    Write-Ok "Firewall rule created for port 3000 (LAN only)"
} else {
    Write-Ok "JM Assist firewall rule already exists"
}

# ============================================================
# 6. SETUP JM ASSIST PROJECT
# ============================================================
Write-Step "Setting up JM Assist at $InstallPath..."

if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Ok "Created directory: $InstallPath"
}

# Check if project files exist (copied from USB/network share)
$packageJson = Join-Path $InstallPath "package.json"
if (-not (Test-Path $packageJson)) {
    Write-Warn @"
JM Assist source code not found at $InstallPath!

Please copy the project files first:
  1. Copy the entire ADOFF folder to $InstallPath
  2. Or use: xcopy /E /I \\192.168.68.54\share\ADOFF $InstallPath

Then run this script again with -SkipNodeInstall -SkipGitInstall -SkipSSH
"@
    Write-Host ""
    Write-Host "The tools (Node.js, Git, SSH) have been installed successfully." -ForegroundColor Green
    Write-Host "Copy the project files and run this script again to continue setup." -ForegroundColor Yellow
    exit 0
}

# Copy .env.bosgame -> .env.local
$envBosgame = Join-Path $InstallPath ".env.bosgame"
$envLocal = Join-Path $InstallPath ".env.local"
if (Test-Path $envBosgame) {
    Copy-Item $envBosgame $envLocal -Force
    Write-Ok "Copied .env.bosgame -> .env.local"
} elseif (-not (Test-Path $envLocal)) {
    Write-Warn ".env.local not found! Copy .env.bosgame to .env.local manually."
}

# Install npm dependencies
Write-Host "   Installing npm dependencies (this may take a few minutes)..."
Push-Location $InstallPath
try {
    npm install 2>&1 | Out-Null
    Write-Ok "npm install complete"
} catch {
    Write-Err "npm install failed: $_"
    exit 1
}

# Build Next.js
Write-Host "   Building JM Assist (Next.js production build)..."
try {
    npm run build 2>&1 | Out-Null
    Write-Ok "Next.js build complete"
} catch {
    Write-Err "Build failed: $_"
    Write-Warn "You can try building manually: cd $InstallPath && npm run build"
}
Pop-Location

# ============================================================
# 7. CREATE WINDOWS SERVICE / STARTUP TASK
# ============================================================
Write-Step "Creating startup task for JM Assist..."

$taskName = "JMAssist"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Warn "Removed existing scheduled task"
}

$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c cd /d $InstallPath && npm run start > $InstallPath\logs\jmassist.log 2>&1" `
    -WorkingDirectory $InstallPath

$trigger = New-ScheduledTaskTrigger -AtLogon
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 0)

# Create logs directory
New-Item -ItemType Directory -Path "$InstallPath\logs" -Force -ErrorAction SilentlyContinue | Out-Null

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "JM Assist Workshop ERP" | Out-Null
Write-Ok "Scheduled task '$taskName' created (starts at logon)"

# ============================================================
# 8. START JM ASSIST
# ============================================================
Write-Step "Starting JM Assist..."

Push-Location $InstallPath
Start-Process cmd.exe -ArgumentList "/c npm run start > logs\jmassist.log 2>&1" -WindowStyle Hidden
Pop-Location

Start-Sleep -Seconds 5

# Test if it's running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    Write-Ok "JM Assist is running at http://localhost:3000"
    Write-Ok "Accessible from LAN at http://192.168.68.71:3000"
} catch {
    Write-Warn "JM Assist may still be starting up. Check: http://localhost:3000"
}

# ============================================================
# DONE
# ============================================================
Write-Host @"

  ============================================
   SETUP COMPLETE!
  ============================================

   JM Assist:  http://192.168.68.71:3000
   SSH:        ssh $env:USERNAME@192.168.68.71
   Logs:       $InstallPath\logs\jmassist.log

   Auto-start: JM Assist starts automatically at logon
   Manual:     cd $InstallPath && npm run start

  ============================================

"@ -ForegroundColor Green

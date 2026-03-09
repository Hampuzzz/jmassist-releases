const { app, BrowserWindow, shell, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");
const http = require("http");

// ─── Hardware Acceleration (before app.whenReady) ───────────────────────────
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512");

// ─── Configuration ───────────────────────────────────────────────────────────
const DEV_MODE = !app.isPackaged;
const NEXT_PORT = 3000;
const LOOKUP_PORT = 8100;
const APP_VERSION = require(path.join(__dirname, "..", "package.json")).version;
const PROJECT_ROOT = DEV_MODE
  ? path.resolve(__dirname, "..")
  : path.resolve(process.resourcesPath, "app");

// ─── Icon path ──────────────────────────────────────────────────────────────
const ICON_PATH = DEV_MODE
  ? path.join(__dirname, "resources", "icon.ico")
  : path.join(process.resourcesPath, "app", "..", "electron", "resources", "icon.ico");

// Use the actual icon file or fall back to undefined (Electron default)
const resolvedIcon = fs.existsSync(ICON_PATH) ? ICON_PATH : undefined;
if (!resolvedIcon) {
  // Try alternate location in packaged app
  const altIcon = path.join(__dirname, "resources", "icon.ico");
  if (fs.existsSync(altIcon)) {
    // altIcon works
  }
}

// ─── Load .env.local into process.env ───────────────────────────────────────
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf-8");
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

const envLocalPath = path.join(PROJECT_ROOT, ".env.local");
const envVars = loadEnvFile(envLocalPath);
console.log(`[electron] Loaded ${Object.keys(envVars).length} env vars from .env.local`);
console.log(`[electron] VEHICLE_LOOKUP_URL = ${envVars.VEHICLE_LOOKUP_URL ?? "(not set)"}`);
console.log(`[electron] DEV_MODE = ${DEV_MODE}`);
console.log(`[electron] PROJECT_ROOT = ${PROJECT_ROOT}`);

// Merge into process.env (don't overwrite existing system env vars)
for (const [key, value] of Object.entries(envVars)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

// Fix disk cache permissions on Windows
const userDataPath = path.join(app.getPath("userData"), "jmassist");
app.setPath("userData", userDataPath);

let mainWindow = null;
let nextProcess = null;
let lookupProcess = null;

// ─── Helper: spawn Node.js (works both dev and packaged) ────────────────────
// In packaged Electron, "node" is not in PATH. Use Electron's own binary
// with ELECTRON_RUN_AS_NODE=1 to act as a Node.js runtime.
function spawnNode(scriptPath, opts = {}) {
  const env = { ...process.env, ...envVars, ...(opts.env || {}) };

  if (DEV_MODE) {
    return spawn("node", [scriptPath], {
      ...opts,
      env,
      stdio: "pipe",
      windowsHide: true,
    });
  }

  // Production: use Electron binary as Node.js
  return spawn(process.execPath, [scriptPath], {
    ...opts,
    env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "pipe",
    windowsHide: true,
  });
}

// ─── Helper: HTTP GET check ─────────────────────────────────────────────────
function httpCheck(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
      resolve(true);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

// ─── Helper: wait for HTTP to respond ────────────────────────────────────────
function waitForHttp(port, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = async () => {
      const ok = await httpCheck(port);
      if (ok) return resolve();
      if (Date.now() - start > timeout) {
        return reject(new Error(`Timeout: port ${port} svarar inte efter ${timeout / 1000}s`));
      }
      setTimeout(check, 1000);
    };
    check();
  });
}

// ─── Kill process tree on Windows ────────────────────────────────────────────
function killProcessTree(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
    } else {
      proc.kill("SIGTERM");
    }
  } catch { /* ignore */ }
}

// ─── Start Next.js server ────────────────────────────────────────────────────
async function startNextServer() {
  const alreadyRunning = await httpCheck(NEXT_PORT);
  if (alreadyRunning) {
    console.log(`[electron] Next.js already running on port ${NEXT_PORT}`);
    return;
  }

  console.log("[electron] Starting Next.js...");

  if (DEV_MODE) {
    const nextBin = path.join(PROJECT_ROOT, "node_modules", ".bin", "next.cmd");
    nextProcess = spawn(nextBin, ["dev", "--hostname", "0.0.0.0", "--port", String(NEXT_PORT)], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      shell: true,
      stdio: "pipe",
      windowsHide: true,
    });
  } else {
    const serverPath = path.join(PROJECT_ROOT, ".next", "standalone", "server.js");
    console.log(`[electron] Server path: ${serverPath}`);
    console.log(`[electron] Server exists: ${fs.existsSync(serverPath)}`);

    nextProcess = spawnNode(serverPath, {
      cwd: path.join(PROJECT_ROOT, ".next", "standalone"),
      env: {
        PORT: String(NEXT_PORT),
        HOSTNAME: "0.0.0.0",
      },
    });
  }

  nextProcess.stdout?.on("data", (d) => console.log(`[next] ${d.toString().trim()}`));
  nextProcess.stderr?.on("data", (d) => console.error(`[next:err] ${d.toString().trim()}`));
  nextProcess.on("error", (err) => console.error(`[next:spawn-error] ${err.message}`));
  nextProcess.on("close", (code) => console.log(`[next] exited: ${code}`));
}

// ─── Start Vehicle Lookup Service ────────────────────────────────────────────
async function startLookupService() {
  const alreadyRunning = await httpCheck(LOOKUP_PORT);
  if (alreadyRunning) {
    console.log(`[electron] Lookup service already running on port ${LOOKUP_PORT}`);
    return;
  }

  const scriptPath = path.join(PROJECT_ROOT, "scripts", "vehicle-lookup-service.mjs");
  if (!fs.existsSync(scriptPath)) {
    console.log(`[electron] Lookup script not found: ${scriptPath}, skipping`);
    return;
  }

  console.log("[electron] Starting lookup service...");
  lookupProcess = spawnNode(scriptPath, { cwd: PROJECT_ROOT });

  lookupProcess.stdout?.on("data", (d) => console.log(`[lookup] ${d.toString().trim()}`));
  lookupProcess.stderr?.on("data", (d) => console.error(`[lookup:err] ${d.toString().trim()}`));
  lookupProcess.on("error", (err) => console.error(`[lookup:spawn-error] ${err.message}`));
  lookupProcess.on("close", (code) => console.log(`[lookup] exited: ${code}`));
}

// ─── Create main browser window ─────────────────────────────────────────────
function createWindow() {
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: `JM Assist v${APP_VERSION}`,
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─── Find icon path ─────────────────────────────────────────────────────────
function getIconPath() {
  // Try multiple locations
  const candidates = [
    path.join(__dirname, "resources", "icon.ico"),
    path.join(process.resourcesPath || "", "electron", "resources", "icon.ico"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[electron] Icon found: ${p}`);
      return p;
    }
  }
  console.log("[electron] No icon file found");
  return undefined;
}

// ─── Auto-start IPC handlers ────────────────────────────────────────────────
ipcMain.handle("get-auto-start", () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle("set-auto-start", (_, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
  return enabled;
});

// ─── Login window IPC handler ───────────────────────────────────────────────
// Opens a BrowserWindow on the user's PC for car.info / biluppgifter login.
// After successful login, extracts cookies and returns them so they can be
// forwarded to MagicNUC where the scraper runs.
ipcMain.handle("open-login-window", async (_event, { url, site }) => {
  const { session: electronSession } = require("electron");
  const partition = `persist:login-${site}`;

  return new Promise((resolve) => {
    const loginWin = new BrowserWindow({
      width: 1300,
      height: 920,
      title: `Logga in — ${site}`,
      icon: getIconPath(),
      parent: mainWindow,
      autoHideMenuBar: true,
      backgroundColor: "#f5f5f5",
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    loginWin.setMenu(null);

    const loginSession = electronSession.fromPartition(partition);
    loginWin.loadURL(url);

    let resolved = false;
    const TIMEOUT_MS = 300_000; // 5 minutes

    async function extractAndResolve(reason) {
      if (resolved) return;
      resolved = true;
      try {
        // Get all cookies from the login session
        const allCookies = await loginSession.cookies.get({});
        // Filter for relevant domains
        const siteDomain = site === "car.info" ? "car.info" : "biluppgifter";
        const relevant = allCookies.filter((c) =>
          c.domain.toLowerCase().includes(siteDomain)
        );
        // Convert to Playwright-compatible format
        const playwrightCookies = relevant.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || "/",
          httpOnly: !!c.httpOnly,
          secure: !!c.secure,
          sameSite: c.sameSite === "no_restriction" ? "None"
                  : c.sameSite === "lax" ? "Lax"
                  : c.sameSite === "strict" ? "Strict"
                  : "Lax",
          expires: c.expirationDate || -1,
        }));
        // Get the user-agent from the login window (needed for cf_clearance matching)
        const loginUA = loginWin.webContents.getUserAgent();
        console.log(`[login-window] ${reason}: Got ${playwrightCookies.length} cookies for ${site}, UA: ${loginUA.slice(0, 60)}...`);
        resolve({ success: playwrightCookies.length > 0, cookies: playwrightCookies, userAgent: loginUA });
      } catch (err) {
        console.error(`[login-window] Cookie extraction error: ${err.message}`);
        resolve({ success: false, cookies: [] });
      }
      try { loginWin.close(); } catch {}
    }

    // Detect successful login via URL change
    function checkUrl(newUrl) {
      if (resolved) return;
      const u = newUrl.toLowerCase();
      const isLogin = u.includes("/login") || u.includes("/logga-in") || u.includes("/sign-in") || u.includes("/user/login");
      if (!isLogin && (u.includes("car.info") || u.includes("biluppgifter"))) {
        // User navigated away from login page = logged in
        setTimeout(() => extractAndResolve("login-detected"), 2000);
      }
    }

    loginWin.webContents.on("did-navigate", (_e, newUrl) => checkUrl(newUrl));
    loginWin.webContents.on("did-navigate-in-page", (_e, newUrl) => checkUrl(newUrl));

    // Also poll cookies every 5s to detect BankID login (may not trigger navigation)
    let initialCookieCount = 0;
    loginSession.cookies.get({}).then((c) => { initialCookieCount = c.length; }).catch(() => {});
    const cookiePoll = setInterval(async () => {
      if (resolved) { clearInterval(cookiePoll); return; }
      try {
        const siteDomain = site === "car.info" ? "car.info" : "biluppgifter";
        const allCookies = await loginSession.cookies.get({});
        const relevant = allCookies.filter((c) => c.domain.toLowerCase().includes(siteDomain));
        // If we got new auth-looking cookies since page load, login probably succeeded
        const hasAuthCookies = relevant.some((c) =>
          c.name.includes("session") || c.name.includes("SESS") ||
          c.name.includes("token") || c.name.includes("auth") ||
          c.name.includes("laravel") || c.name.includes("member") ||
          c.name.includes("_identity") || c.name.includes("logged")
        );
        if (hasAuthCookies && relevant.length > initialCookieCount) {
          console.log(`[login-window] Cookie poll detected auth cookies for ${site}`);
          clearInterval(cookiePoll);
          setTimeout(() => extractAndResolve("cookie-poll-detected"), 2000);
        }
      } catch {}
    }, 5000);

    // If user closes window manually, extract whatever cookies exist
    loginWin.on("closed", () => {
      clearInterval(cookiePoll);
      if (!resolved) {
        resolved = true;
        // Can't get cookies from closed window — resolve empty
        // But the persist:partition keeps them for next time
        loginSession.cookies.get({}).then((allCookies) => {
          const siteDomain = site === "car.info" ? "car.info" : "biluppgifter";
          const relevant = allCookies.filter((c) =>
            c.domain.toLowerCase().includes(siteDomain)
          );
          const playwrightCookies = relevant.map((c) => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
            httpOnly: !!c.httpOnly,
            secure: !!c.secure,
            sameSite: c.sameSite === "no_restriction" ? "None"
                    : c.sameSite === "lax" ? "Lax"
                    : c.sameSite === "strict" ? "Strict"
                    : "Lax",
            expires: c.expirationDate || -1,
          }));
          console.log(`[login-window] window-closed: Got ${playwrightCookies.length} cookies for ${site}`);
          resolve({ success: playwrightCookies.length > 0, cookies: playwrightCookies });
        }).catch(() => {
          resolve({ success: false, cookies: [] });
        });
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => extractAndResolve("timeout"), TIMEOUT_MS);
  });
});

// ─── Auto-update ────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (DEV_MODE) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    console.log(`[updater] Update available: v${info.version}`);
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Uppdatering tillgänglig",
        message: `En ny version (v${info.version}) finns tillgänglig. Vill du ladda ner och installera den?`,
        buttons: ["Ja, uppdatera", "Senare"],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[updater] No update available");
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(`[updater] Download: ${Math.round(progress.percent)}%`);
    if (mainWindow) {
      mainWindow.setProgressBar(progress.percent / 100);
    }
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("[updater] Update downloaded");
    if (mainWindow) mainWindow.setProgressBar(-1);
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        title: "Uppdatering klar",
        message: "Uppdateringen är nedladdad. Appen startas om för att installera.",
        buttons: ["Starta om nu", "Senare"],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err.message);
  });

  // Check for updates 5 seconds after app is ready
  setTimeout(() => {
    console.log("[updater] Checking for updates...");
    autoUpdater.checkForUpdates().catch((err) => {
      console.error("[updater] Check failed:", err.message);
    });
  }, 5000);
}

// ─── App lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createWindow();

  // Load loading screen from file (data: URLs blocked by CSP)
  const loadingPath = path.join(__dirname, "loading.html");
  if (fs.existsSync(loadingPath)) {
    mainWindow.loadFile(loadingPath);
  } else {
    // Fallback: simple HTML string
    mainWindow.loadURL("about:blank");
    mainWindow.webContents.executeJavaScript(`
      document.body.style.cssText = "background:#0a0a0a;color:#e5e5e5;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0";
      document.body.innerHTML = '<div style="text-align:center"><h1 style="font-size:48px;background:linear-gradient(135deg,#f97316,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent">JM Assist</h1><p style="color:#737373;margin-top:16px">Startar server...</p></div>';
    `);
  }
  mainWindow.show();

  try {
    // Start services
    await Promise.all([startNextServer(), startLookupService()]);

    // Wait for Next.js HTTP to respond (up to 60s)
    console.log("[electron] Waiting for Next.js to respond...");
    await waitForHttp(NEXT_PORT, 60000);
    console.log("[electron] Next.js ready! Loading app...");

    if (mainWindow) {
      mainWindow.loadURL(`http://127.0.0.1:${NEXT_PORT}`);
    }

    // Check for updates after app is loaded
    setupAutoUpdater();
  } catch (err) {
    console.error("[electron] Startup failed:", err);
    if (mainWindow) {
      dialog.showErrorBox(
        "Startfel",
        `Kunde inte starta JM Assist.\n\n${err.message}\n\nKontrollera loggarna och starta om.`
      );
    }
  }
});

app.on("window-all-closed", () => {
  killProcessTree(nextProcess);
  killProcessTree(lookupProcess);
  app.quit();
});

app.on("before-quit", () => {
  killProcessTree(nextProcess);
  killProcessTree(lookupProcess);
});

app.on("activate", () => {
  if (!mainWindow) {
    createWindow();
    mainWindow.loadURL(`http://127.0.0.1:${NEXT_PORT}`);
    mainWindow.show();
  }
});

const path = require("path");
const { execSync } = require("child_process");

/**
 * afterPack hook for electron-builder.
 * Embeds the app icon into the exe using rcedit,
 * bypassing the signAndEditExecutable flow (which
 * fails on non-admin Windows due to symlink issues
 * in the winCodeSign cache).
 */
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`
  );

  const iconPath = path.join(__dirname, "resources", "icon.ico");

  // Find rcedit — try @electron/rcedit, then fallback to local copy
  let rceditPath;
  try {
    rceditPath = require.resolve("@electron/rcedit/bin/rcedit-x64.exe");
  } catch {
    try {
      rceditPath = require.resolve("rcedit/bin/rcedit-x64.exe");
    } catch {
      // Fallback: use rcedit from electron-builder cache
      const cacheDir = path.join(
        process.env.LOCALAPPDATA || "",
        "electron-builder",
        "Cache",
        "winCodeSign"
      );
      const fs = require("fs");
      // Search for rcedit in any cache subdirectory
      if (fs.existsSync(cacheDir)) {
        for (const dir of fs.readdirSync(cacheDir)) {
          const candidate = path.join(cacheDir, dir, "rcedit-x64.exe");
          if (fs.existsSync(candidate)) {
            rceditPath = candidate;
            break;
          }
        }
      }
    }
  }

  if (!rceditPath) {
    console.warn("[afterPack] rcedit not found — skipping icon embed");
    return;
  }

  console.log(`[afterPack] Embedding icon into ${path.basename(exePath)}`);
  console.log(`[afterPack] Using rcedit: ${rceditPath}`);

  try {
    execSync(
      `"${rceditPath}" "${exePath}" --set-icon "${iconPath}"`,
      { stdio: "inherit" }
    );
    console.log("[afterPack] Icon embedded successfully");
  } catch (err) {
    console.error("[afterPack] Failed to embed icon:", err.message);
  }
};

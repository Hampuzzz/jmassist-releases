import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

const PROJECT_ROOT = process.cwd();

export async function POST() {
  try {
    // 1. Stash any local changes so pull doesn't fail
    try {
      execSync("git stash --include-untracked", {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
        timeout: 10_000,
      });
    } catch {}

    // 2. Git pull latest code
    const pullResult = execSync("git pull origin main", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 30_000,
    }).trim();

    const alreadyUpToDate =
      pullResult.includes("Already up to date") ||
      pullResult.includes("Already up-to-date");

    if (alreadyUpToDate) {
      return NextResponse.json({
        ok: true,
        message: "Redan uppdaterad",
        needsRestart: false,
      });
    }

    // 3. Read new version from package.json
    let newVersion = "?";
    try {
      delete require.cache[path.join(PROJECT_ROOT, "package.json")];
      newVersion = require(path.join(PROJECT_ROOT, "package.json")).version;
    } catch {}

    // 4. Check if dependencies changed (package.json was in the pull)
    const needsInstall = pullResult.includes("package.json");
    if (needsInstall) {
      try {
        execSync("npm install --production=false", {
          cwd: PROJECT_ROOT,
          encoding: "utf-8",
          timeout: 120_000,
        });
      } catch (e: any) {
        console.warn("[update] npm install warning:", e.message);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Uppdaterad till v${newVersion}`,
      newVersion,
      pullResult,
      needsRestart: true,
    });
  } catch (err: any) {
    console.error("[update] install failed:", err.message);
    return NextResponse.json(
      { error: `Uppdatering misslyckades: ${err.message}` },
      { status: 500 },
    );
  }
}

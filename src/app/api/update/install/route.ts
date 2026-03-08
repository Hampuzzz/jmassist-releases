import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const PROJECT_ROOT = process.cwd();

/** Read version from package.json (uncached) */
function readPackageVersion(): string {
  try {
    const pkgPath = path.join(PROJECT_ROOT, "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw).version ?? "?";
  } catch {
    return "?";
  }
}

/** Update NEXT_PUBLIC_APP_VERSION in .env.local */
function updateEnvVersion(newVersion: string) {
  const envPath = path.join(PROJECT_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, "utf-8");
  if (content.includes("NEXT_PUBLIC_APP_VERSION=")) {
    content = content.replace(
      /NEXT_PUBLIC_APP_VERSION=.*/,
      `NEXT_PUBLIC_APP_VERSION=${newVersion}`,
    );
  } else {
    content += `\nNEXT_PUBLIC_APP_VERSION=${newVersion}\n`;
  }
  fs.writeFileSync(envPath, content, "utf-8");
}

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

    // 3. Read new version from package.json (always fresh from disk)
    const newVersion = readPackageVersion();

    if (alreadyUpToDate) {
      // Even if git is up-to-date, sync .env.local version with package.json
      updateEnvVersion(newVersion);

      return NextResponse.json({
        ok: true,
        message: `Redan uppdaterad (v${newVersion})`,
        newVersion,
        needsRestart: false,
      });
    }

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

    // 5. Update .env.local with the new version
    updateEnvVersion(newVersion);

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

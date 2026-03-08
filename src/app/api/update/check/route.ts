import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const GITHUB_REPO = "Hampuzzz/jmassist-releases";

/** Read version from package.json (fresh from disk, not cached) */
function getCurrentVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw).version ?? "0.0.0";
  } catch {
    return process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
  }
}

function parseVersion(tag: string): number[] {
  return tag.replace(/^v/, "").split(".").map(Number);
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] ?? 0;
    const lv = l[i] ?? 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

export async function GET() {
  try {
    const currentVersion = getCurrentVersion();

    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/tags?per_page=5`,
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        next: { revalidate: 300 }, // cache 5 min
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `GitHub svarade ${res.status}` },
        { status: 502 },
      );
    }

    const tags: { name: string }[] = await res.json();

    if (!tags.length) {
      return NextResponse.json({
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
      });
    }

    // Sort tags by semver descending
    const sorted = tags
      .map((t) => t.name)
      .filter((n) => /^v?\d+\.\d+/.test(n))
      .sort((a, b) => {
        const av = parseVersion(a);
        const bv = parseVersion(b);
        for (let i = 0; i < Math.max(av.length, bv.length); i++) {
          const diff = (bv[i] ?? 0) - (av[i] ?? 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });

    const latestTag = sorted[0] ?? `v${currentVersion}`;
    const latestVersion = latestTag.replace(/^v/, "");
    const updateAvailable = isNewer(latestVersion, currentVersion);

    return NextResponse.json({
      currentVersion,
      latestVersion,
      latestTag,
      updateAvailable,
      repoUrl: `https://github.com/${GITHUB_REPO}`,
      downloadUrl: updateAvailable
        ? `https://github.com/${GITHUB_REPO}/releases/tag/${latestTag}`
        : null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Kunde inte nå GitHub: ${err.message}` },
      { status: 503 },
    );
  }
}

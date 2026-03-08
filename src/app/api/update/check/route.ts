import { NextResponse } from "next/server";

const GITHUB_REPO = "Hampuzzz/jmassist-releases";
const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? require("../../../../../package.json").version;

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
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
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

    const latestTag = sorted[0] ?? `v${CURRENT_VERSION}`;
    const latestVersion = latestTag.replace(/^v/, "");
    const updateAvailable = isNewer(latestVersion, CURRENT_VERSION);

    return NextResponse.json({
      currentVersion: CURRENT_VERSION,
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

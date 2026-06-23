const REPO = "ValMtp3/Juste-Recrute-Moi";
const RELEASES_URL = `https://github.com/${REPO}/releases`;
const TAGS_URL = `https://github.com/${REPO}/tags`;

const EMPTY_ASSETS = { windows: null, mac: null, linux: null };

function classifyAsset(asset) {
  const name = asset.name.toLowerCase();
  const url = asset.browser_download_url;
  const size = asset.size || 0;

  if (
    name.endsWith(".sig") ||
    name === "latest.json" ||
    name.includes("sha256") ||
    name.includes("checksum") ||
    name.includes("browser-runtime")
  ) {
    return [null, null];
  }

  if (/\.(exe|msi|msix)$/.test(name)) {
    return ["windows", { name: asset.name, url, size }];
  }

  if (/\.(dmg|pkg)$/.test(name) || name.endsWith(".app.tar.gz")) {
    return ["mac", { name: asset.name, url, size }];
  }

  if (/\.(appimage|deb|rpm)$/.test(name)) {
    return ["linux", { name: asset.name, url, size }];
  }

  return [null, null];
}

function assetClasser(platform, asset) {
  const name = asset.name.toLowerCase();
  const ranks = {
    windows: [
      [/\.(exe)$/, 0],
      [/\.(msi)$/, 1],
      [/\.(msix)$/, 2],
    ],
    mac: [
      [/\.(dmg)$/, 0],
      [/\.(pkg)$/, 1],
    ],
    linux: [
      [/\.(appimage)$/, 0],
      [/\.(deb)$/, 1],
      [/\.(rpm)$/, 2],
    ],
  };

  const match = ranks[platform]?.find(([pattern]) => pattern.test(name));
  return match ? match[1] : 99;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "juste-recrute-moi-website",
    },
  });
  if (!res.ok) {
    const error = new Error(`GitHub Releases API responded with ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

function releasePayload(release) {
  const assets = { ...EMPTY_ASSETS };

  for (const asset of release.assets || []) {
    const [platform, payload] = classifyAsset(asset);
    if (
      platform &&
      (!assets[platform] || assetClasser(platform, payload) < assetClasser(platform, assets[platform]))
    ) {
      assets[platform] = payload;
    }
  }

  return {
    available: Boolean(release.tag_name),
    tag: release.tag_name,
    name: release.name || release.tag_name,
    publishedAt: release.published_at,
    url: release.html_url || RELEASES_URL,
    assets,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    let release = null;
    try {
      release = await fetchJson(`https://api.github.com/repos/${REPO}/releases/latest`);
    } catch (error) {
      if (error.status !== 404) throw error;
      const releases = await fetchJson(`https://api.github.com/repos/${REPO}/releases?per_page=10`);
      release = releases.find((item) => !item.draft && !item.prerelease) || releases.find((item) => !item.draft) || null;
    }

    if (!release) {
      response.setHeader("cache-control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
      response.status(200).json({
        available: false,
        tag: null,
        url: RELEASES_URL,
        tagsUrl: TAGS_URL,
        assets: EMPTY_ASSETS,
      });
      return;
    }

    response.setHeader("cache-control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
    response.status(200).json({ ...releasePayload(release), tagsUrl: TAGS_URL });
  } catch (error) {
    response.setHeader("cache-control", "public, max-age=30, s-maxage=60");
    response.status(200).json({
      available: false,
      tag: null,
      url: RELEASES_URL,
      tagsUrl: TAGS_URL,
      assets: EMPTY_ASSETS,
      error: "release_lookup_failed",
    });
  }
}

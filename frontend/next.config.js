const fs = require("fs");
const path = require("path");

// Fall back to the repo-root .env when running `next dev`/`next build`
// directly (outside docker-compose, which injects the same file's vars
// via `env_file:`). Real env vars already set always win.
const rootEnvPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(rootEnvPath)) {
  for (const line of fs.readFileSync(rootEnvPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dev-mode "N" badge sits on top of the map's zoom control.
  devIndicators: false,
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;

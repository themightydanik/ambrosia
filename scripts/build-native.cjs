const fs = require("node:fs");
const path = require("node:path");
const { buildSync } = require("esbuild");
const id = process.env.GOOGLE_PLAY_APPLICATION_ID,
  origin = process.env.NATIVE_API_ORIGIN;
if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(id || ""))
  throw Error(
    "Set GOOGLE_PLAY_APPLICATION_ID to the owner-selected Google Play package name.",
  );
const url = new URL(origin);
if (
  url.protocol !== "https:" ||
  url.origin !== origin ||
  url.username ||
  url.password
)
  throw Error(
    "NATIVE_API_ORIGIN must be the exact trusted HTTPS Netlify origin, with no path or trailing slash.",
  );
const out = "native-dist";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const name of [
  "index.html",
  "manifest.json",
  "css",
  "js",
  "assets",
  "icons",
])
  if (fs.existsSync(name))
    fs.cpSync(name, path.join(out, name), { recursive: true });
// Bundle only the native bridge, never keys, secrets, server functions or node_modules.
buildSync({
  entryPoints: ["native/sdk.js"],
  outfile: path.join(out, "js/native-sdk.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
const htmlPath = path.join(out, "index.html");
const csp =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' " +
  origin +
  " https://*.supabase.co wss://*.supabase.co https://esm.sh; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'";
fs.writeFileSync(
  htmlPath,
  fs
    .readFileSync(htmlPath, "utf8")
    .replace(
      "<head>",
      '<head><meta http-equiv="Content-Security-Policy" content="' + csp + '">',
    ),
);
fs.writeFileSync(
  path.join(out, "native-config.json"),
  JSON.stringify({ apiOrigin: origin }),
);
fs.writeFileSync(
  "capacitor.config.json",
  JSON.stringify(
    {
      appId: id,
      appName: "Ambrosia",
      webDir: out,
      server: {
        androidScheme: "https",
        hostname: "localhost",
        cleartext: false,
      },
      android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
      plugins: { CapacitorCookies: { enabled: false } },
    },
    null,
    2,
  ),
);
console.log(
  "Native assets prepared. Credentials are fetched only after authentication.",
);

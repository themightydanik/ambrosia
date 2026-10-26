const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const cap = require.resolve("@capacitor/cli/bin/capacitor");
if (!fs.existsSync("android"))
  execFileSync(process.execPath, [cap, "add", "android"], { stdio: "inherit" });
execFileSync(process.execPath, [cap, "sync", "android"], { stdio: "inherit" });
const manifest = "android/app/src/main/AndroidManifest.xml";
let xml = fs
  .readFileSync(manifest, "utf8")
  .replace('android:allowBackup="true"', 'android:allowBackup="false"')
  .replace('android:launchMode="singleTask"', 'android:launchMode="singleTop"');
if (!xml.includes("android:usesCleartextTraffic"))
  xml = xml.replace(
    "<application",
    '<application android:usesCleartextTraffic="false"',
  );
fs.writeFileSync(manifest, xml);
const file = "android/app/build.gradle";
let gradle = fs.readFileSync(file, "utf8");
const code = Number(process.env.NATIVE_VERSION_CODE),
  version = process.env.NATIVE_VERSION_NAME || "1.0.0";
if (
  !Number.isInteger(code) ||
  code < 1 ||
  code > 2100000000 ||
  !/^\d+\.\d+\.\d+$/.test(version)
)
  throw Error(
    "Set an increasing NATIVE_VERSION_CODE and numeric NATIVE_VERSION_NAME.",
  );
gradle = gradle
  .replace(/versionCode \d+/, `versionCode ${code}`)
  .replace(/versionName "[^"]+"/, `versionName "${version}"`);
if (!gradle.includes("// Ambrosia signing"))
  gradle += `
// Ambrosia signing: secret values are read from the ephemeral runner environment only.
if (System.getenv('ANDROID_KEYSTORE_FILE')) {
 android.signingConfigs.create('ownerRelease') {
  storeFile file(System.getenv('ANDROID_KEYSTORE_FILE'))
  storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
  keyAlias System.getenv('ANDROID_KEY_ALIAS')
  keyPassword System.getenv('ANDROID_KEY_PASSWORD')
 }
 android.buildTypes.release.signingConfig = android.signingConfigs.ownerRelease
}
`;
fs.writeFileSync(file, gradle);
// Local, bundled content only. Capacitor's default navigation policy opens other origins externally.
console.log(
  "Android prepared: singleTop, backups disabled, HTTPS-only, no allowed remote WebView origins.",
);

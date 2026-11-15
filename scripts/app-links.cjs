const fs = require("node:fs");
const path = require("node:path");
function nativeCallback(value) {
  if (!value) return null;
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    !/^[a-z0-9.-]+$/i.test(u.hostname) ||
    u.port ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/auth/native-callback.html"
  )
    throw Error(
      "NATIVE_AUTH_CALLBACK_URL must be an owner HTTPS URL ending /auth/native-callback.html",
    );
  return u;
}
function writeAssociation(out, env = process.env) {
  const callback = nativeCallback(env.AUTH_NATIVE_CALLBACK_URL);
  if (!callback) return;
  const id = env.GOOGLE_PLAY_APPLICATION_ID,
    fingerprints = (env.ANDROID_APP_LINK_CERT_SHA256 || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  if (!id && !fingerprints.length) return; // Not configured: owner must not mark Android flow validated.
  if (
    !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(id || "") ||
    !fingerprints.length ||
    fingerprints.some((v) => !/^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/.test(v))
  )
    throw Error(
      "Owner package ID and actual SHA-256 app-signing/debug certificate fingerprints required for App Links",
    );
  fs.mkdirSync(path.join(out, ".well-known"), { recursive: true });
  fs.writeFileSync(
    path.join(out, ".well-known/assetlinks.json"),
    JSON.stringify(
      [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: id,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ],
      null,
      2,
    ),
  );
}
function androidIntentFilter(xml, callback) {
  xml = xml.replace(
    /\s*<!-- Ambrosia App Link -->[\s\S]*?<!-- End Ambrosia App Link -->\r?\n?/g,
    "",
  );
  if (!callback) return xml;
  if (!xml.includes("</activity>")) throw Error("Android activity missing");
  return xml.replace(
    "</activity>",
    `<!-- Ambrosia App Link -->
<intent-filter android:autoVerify="true">
 <action android:name="android.intent.action.VIEW" />
 <category android:name="android.intent.category.DEFAULT" />
 <category android:name="android.intent.category.BROWSABLE" />
 <data android:scheme="https" android:host="${callback.hostname}" android:path="${callback.pathname}" />
</intent-filter>
<!-- End Ambrosia App Link -->
</activity>`,
  );
}
module.exports = { nativeCallback, writeAssociation, androidIntentFilter };

// Synthetic GoTrue + Capacitor fixtures only. Does not certify real Google or Android App Links.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const origin = "https://app.example.invalid",
  callback = origin + "/auth/oauth-callback.html",
  nativeCallback = origin + "/auth/native-callback.html";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = {
  id: A,
  email: "synthetic@example.invalid",
  email_confirmed_at: "2026-01-01",
  identities: [
    {
      provider: "google",
      identity_data: { sub: "synthetic-google", email_verified: true },
    },
  ],
};
const code = "11111111-1111-4111-8111-111111111111";
const legacy = JSON.stringify([
  {
    id: 123,
    date: "2026-11-01",
    time: "12:00",
    timestamp: "2026-11-01T12:00:00Z",
    notes: "Synthetic device record",
    symptoms: [],
    triggers: [],
    intensity: 2,
    statusUpdates: [],
  },
]);
const errors = [];
let browser;
(async () => {
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    args: ["--no-sandbox"],
  });
  const shots =
    process.env.UPDATE_AUTH_SCREENSHOTS === "1"
      ? "docs/account-migration/screenshots"
      : "/tmp/ambrosia-auth-screenshots";
  fs.mkdirSync(shots, { recursive: true });
  async function device({
    enabled = true,
    required = false,
    guest = true,
    returning = false,
    native = false,
    lang = "en",
    colorScheme = "light",
  } = {}) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme,
      serviceWorkers: "block",
    });
    ctx.setDefaultTimeout(15000);
    const controls = {
      enabled,
      required,
      failConfig: false,
      exchangeCalls: 0,
      userCalls: 0,
      identity: user,
      delayToken: null,
    };
    await ctx.addInitScript(
      ({ legacy, guest, native, lang, returning }) => {
        if (location.hostname !== "app.example.invalid") return;
        if (!localStorage.getItem("__auth_seed")) {
          localStorage.setItem("__auth_seed", "1");
          if (returning) localStorage.setItem("ambrosia_onboarding_done", "1");
          localStorage.setItem("ambrosia_lang", lang);
          if (guest) localStorage.setItem("ambrosia_entries", legacy);
        }
        if (native)
          window.Capacitor = {
            isNativePlatform: () => true,
            getPlatform: () => "android",
          };
      },
      { legacy, guest, native, lang, returning },
    );
    let sdk = fs.readFileSync("tests/mock-supabase.js", "utf8").replace(
      "const auth = {",
      `const auth = {
    async setSession(tokens) {window.testInstalled=tokens;auth.setUser(${JSON.stringify(user)});return {data:{session:{user}},error:null};},
    async signUp({email,options}) {window.testSignup={email,options};return {data:{session:null,user:null}};},`,
    );
    sdk = sdk.replace(
      "let user =",
      'if(location.pathname === "/auth/oauth-callback.html" && location.search) throw Error("Callback was not scrubbed before SDK initialization"); let user =',
    );
    await ctx.route("**/*", async (r) => {
      const u = new URL(r.request().url());
      if (u.hostname === "esm.sh")
        return r.fulfill({ contentType: "text/javascript", body: sdk });
      if (u.pathname === "/native-config.json")
        return r.fulfill({
          json: { apiOrigin: origin, authCallback: nativeCallback },
        });
      if (u.pathname === "/api/auth-config")
        return r.fulfill(
          controls.failConfig
            ? { status: 503, json: { error: "unavailable" } }
            : {
                json: {
                  webCallback: callback,
                  nativeCallback,
                  googleWebEnabled: controls.enabled,
                  googleAndroidEnabled: controls.enabled,
                  requireAccounts: controls.required,
                },
              },
        );
      if (u.pathname === "/api/supabase-config")
        return r.fulfill({
          json: {
            url: "https://fixture.supabase.invalid",
            publishableKey: "public-fixture",
          },
        });
      if (u.pathname === "/api/account-status")
        return r.fulfill({
          json: { userId: A, tier: "free", state: "free", aiEnabled: false },
        });
      if (u.pathname.startsWith("/api/"))
        return r.fulfill({
          status: 503,
          json: { error: "unconfigured fixture" },
        });
      if (u.pathname.startsWith("/__test/")) return r.fulfill({ json: [] });
      if (u.hostname === "fixture.supabase.invalid") {
        if (u.pathname === "/auth/v1/authorize") {
          const back = new URL(u.searchParams.get("redirect_to"));
          back.searchParams.set("code", code);
          return r.fulfill({
            contentType: "text/html",
            body:
              "<script>location.replace(" +
              JSON.stringify(back.href) +
              ")</script>",
          });
        }
        if (u.pathname === "/auth/v1/token") {
          controls.exchangeCalls++;
          if (controls.delayToken) await controls.delayToken;
          return r.fulfill({
            json: {
              access_token: "fixture-access",
              refresh_token: "fixture-refresh",
              user,
            },
          });
        }
        if (u.pathname === "/auth/v1/user") {
          controls.userCalls++;
          return r.fulfill({ json: controls.identity });
        }
        return r.fulfill({ status: 404, body: "" });
      }
      if (u.pathname === "/js/native-sdk.js")
        return r.fulfill({
          contentType: "text/javascript",
          body: `
    window.nativeListeners={};
    const listen=async(name,fn)=>{window.nativeListeners[name]=fn;return {remove(){}};};
    export const App={addListener:listen,getLaunchUrl:async()=>({url:sessionStorage.getItem('__launch_url')})};
    export const Browser={addListener:listen,open:async({url})=>{window.nativeBrowserURL=url;},close:async()=>{window.nativeBrowserClosed=true;}};
    export const Filesystem={rmdir:async()=>{},writeFile:async()=>({uri:'fixture://export'}),deleteFile:async()=>{}};
    export const Directory={Cache:'CACHE'};export const Share={share:async()=>{}};export const Purchases={};
   `,
        });
      if (u.origin !== origin) return r.fulfill({ status: 404, body: "" });
      const file = path.resolve(
        "web-dist",
        "." + (u.pathname === "/" ? "/index.html" : u.pathname),
      );
      if (
        !file.startsWith(path.resolve("web-dist") + path.sep) ||
        !fs.existsSync(file)
      )
        return r.fulfill({ status: 404, body: "" });
      const ext = path.extname(file);
      return r.fulfill({
        body: fs.readFileSync(file),
        contentType:
          {
            ".js": "text/javascript",
            ".css": "text/css",
            ".png": "image/png",
            ".woff2": "font/woff2",
            ".json": "application/json",
          }[ext] || "text/html",
      });
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("PAGEERROR", e.message);
    });
    await page.goto(origin);
    await page.waitForFunction(
      async () =>
        !!window.testAuth &&
        !!(await import("/js/auth/config.js")).authSettings(),
    );
    await page.waitForTimeout(300); // wait for the existing startup navigation timer
    const initialStep = await page
      .locator("#screen-onboarding")
      .getAttribute("data-step");
    if (await page.locator("#ob-skip").count())
      await page.locator("#ob-skip").click();
    await page.locator("#ob-email:not([disabled])").waitFor();
    return { ctx, page, controls, initialStep };
  }
  // Default off: no fake Google control, existing guest entry still works.
  const off = await device({ enabled: false });
  assert.equal(await off.page.locator("#auth-google").count(), 0);
  await off.page.locator("#ob-guest").click();
  await off.page.locator("#screen-home.active").waitFor();
  assert.equal(
    await off.page.evaluate(() => localStorage.getItem("ambrosia_entries")),
    legacy,
  );
  await off.ctx.close();
  console.log(
    "PASS: disabled rollout preserves existing guest navigation and originals.",
  );
  // Google registration through actual app callback module, with only external GoTrue/SDK mocked.
  const web = await device();
  await web.page.locator("#auth-google").click();
  await web.page.locator("#ob-continue-account").waitFor();
  assert.equal(web.controls.exchangeCalls, 1);
  assert.equal(web.controls.userCalls, 1);
  assert.equal(
    await web.page.evaluate(() => localStorage.getItem("ambrosia_entries")),
    legacy,
  );
  assert.equal(
    await web.page.evaluate(
      () =>
        Object.values(
          JSON.parse(
            localStorage.getItem(
              "ambrosia_sync_v2:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            ) || '{"records":{}}',
          ).records,
        ).filter((x) => x.kind === "entry").length,
    ),
    0,
  );
  await web.page.screenshot({
    path: path.join(shots, "google-account-synthetic.png"),
    fullPage: true,
  });
  await web.page.locator("#ob-continue-account").click();
  await web.page.evaluate(() => window.goTo("settings"));
  await web.page
    .locator("[data-google-deletion-help]")
    .waitFor({ state: "attached" });
  assert.ok(
    (
      await web.page.locator("[data-google-deletion-help]").textContent()
    ).includes("set a password"),
  );
  await web.page.goto(callback + "?nonce=replayed&code=" + code);
  await web.page
    .getByRole("status")
    .filter({ hasText: "could not be confirmed" })
    .waitFor();
  assert.equal(web.controls.exchangeCalls, 1);
  await web.ctx.close();
  console.log(
    "PASS: fresh Google callback commits once; no automatic guest migration; replay rejected.",
  );
  const rejected = await device();
  rejected.controls.identity = {
    ...user,
    identities: [
      {
        provider: "google",
        identity_data: { sub: "synthetic", email_verified: false },
      },
    ],
  };
  await rejected.page.locator("#auth-google").click();
  await rejected.page
    .getByRole("status")
    .filter({ hasText: "could not be confirmed" })
    .waitFor();
  assert.equal(
    await rejected.page.evaluate(() => localStorage.getItem("__test_user")),
    null,
  );
  assert.equal(
    await rejected.page.evaluate(() => window.testInstalled),
    undefined,
  );
  assert.equal(rejected.controls.exchangeCalls, 1);
  await rejected.ctx.close();
  console.log(
    "PASS: unverified provider identity cannot install an SDK session.",
  );
  // Mandatory UI staging, independent guest export, cancellation, rollback and locales/themes.
  for (const lang of ["en", "uk", "ru"]) {
    const d = await device({
        required: true,
        returning: true,
        lang,
        colorScheme: lang === "ru" ? "dark" : "light",
      }),
      p = d.page;
    assert.equal(await p.locator("#ob-guest").count(), 0);
    await p.locator("#auth-device-recovery").waitFor();
    assert.equal(await p.evaluate(() => document.documentElement.lang), lang);
    await p.screenshot({
      path: path.join(shots, "mandatory-" + lang + "-synthetic.png"),
      fullPage: true,
    });
    await p.setViewportSize({ width: 320, height: 640 });
    await p.locator("#auth-google").scrollIntoViewIfNeeded();
    const box = await p.locator("#auth-google").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 320);
    assert.equal(
      await p
        .locator("#screen-onboarding")
        .evaluate((node) => node.scrollWidth <= node.clientWidth),
      true,
    );
    await p.setViewportSize({ width: 390, height: 844 });
    await p.locator("#auth-device-recovery").click();
    await p.locator("#screen-device-recovery.active").waitFor();
    await p.locator("#screen-device-recovery summary").click();
    assert.ok(
      (await p.locator("#screen-device-recovery pre").innerText()).includes(
        "Synthetic device record",
      ),
    );
    await p.locator("#screen-device-recovery summary").click();
    const download = p.waitForEvent("download");
    await p.locator("#screen-device-recovery > div > button").first().click();
    const file = await (await download).path();
    const archive = JSON.parse(fs.readFileSync(file));
    assert.equal(archive.originals.ambrosia_entries, legacy);
    assert.equal(Object.keys(archive.originals).length, 4);
    assert.equal(
      await p.evaluate(() => localStorage.getItem("ambrosia_entries")),
      legacy,
    );
    if (lang === "en")
      await p.screenshot({
        path: path.join(shots, "device-recovery-synthetic.png"),
        fullPage: true,
      });
    await p.locator("#screen-device-recovery button").last().click();
    await p.locator("#ob-email").waitFor();
    await p.evaluate(async () => {
      const { goTo } = await import("/js/navigation.js");
      goTo("home");
    });
    await p.locator("#screen-onboarding.active").waitFor();
    d.controls.failConfig = true;
    await p.reload();
    await p.locator("#auth-device-recovery").waitFor();
    assert.equal(await p.locator("#ob-guest").count(), 0);
    assert.equal(await p.locator("#auth-google").count(), 0);
    d.controls.failConfig = false;
    d.controls.required = false;
    await p.reload();
    await p.locator("#screen-home.active").waitFor();
    assert.equal(
      await p.evaluate(() => localStorage.getItem("ambrosia_entries")),
      legacy,
    );
    await d.ctx.close();
  }
  console.log(
    "PASS: EN/UK/RU, staged mandatory UI, export originals, offline remembered restriction and rollback without erasure.",
  );
  const fresh = await device({ required: true, guest: false });
  assert.equal(fresh.initialStep, "1");
  assert.equal(await fresh.page.locator("#ob-guest").count(), 0);
  assert.equal(await fresh.page.locator("#auth-device-recovery").count(), 0);
  await fresh.ctx.close();
  // Email registration confirmation and password reset still use the existing SDK and redirect semantics.
  const email = await device({ required: true, enabled: false });
  await email.page.locator("#ob-email").click();
  await email.page
    .locator("#welcome-account-form input[type=email]")
    .fill("new@example.invalid");
  await email.page
    .locator("#welcome-account-form input[type=password]")
    .fill("synthetic-password-123");
  await email.page
    .getByRole("button", { name: "Sign up", exact: true })
    .click();
  await email.page.waitForFunction(() => window.testSignup);
  assert.equal(
    await email.page.evaluate(() => window.testSignup.options.emailRedirectTo),
    origin + "/",
  );
  await email.page
    .getByRole("button", { name: "Send password reset email", exact: true })
    .click();
  await email.page.waitForFunction(() => window.testReset);
  assert.equal(
    await email.page.evaluate(() => window.testReset.options.redirectTo),
    origin + "/",
  );
  await email.ctx.close();
  console.log(
    "PASS: email signup confirmation and recovery keep legacy redirect contract.",
  );
  // Android system-browser callback, cancellation, cold start and account switching use app modules.
  const race = await device({ native: true, required: true });
  let release;
  race.controls.delayToken = new Promise((resolve) => (release = resolve));
  await race.page.locator("#auth-google").click();
  await race.page.waitForFunction(() => window.nativeBrowserURL);
  await race.page.evaluate((code) => {
    const back = new URL(
      new URL(window.nativeBrowserURL).searchParams.get("redirect_to"),
    );
    back.searchParams.set("code", code);
    window.nativeListeners.appUrlOpen({ url: back.href });
  }, code);
  for (
    let attempt = 0;
    attempt < 500 && !race.controls.exchangeCalls;
    attempt++
  )
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(race.controls.exchangeCalls, 1);
  await race.page.evaluate(() =>
    window.testAuth.setUser({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      email: "b@example.invalid",
    }),
  );
  release();
  await race.page.waitForTimeout(250);
  assert.equal(await race.page.evaluate(() => window.testInstalled), undefined);
  assert.equal(
    await race.page.evaluate(
      async () => (await import("/js/state.js")).state.accountId,
    ),
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  await race.page.evaluate((user) => window.testAuth.setUser(user), user);
  assert.equal(
    await race.page.evaluate(
      async () => (await import("/js/state.js")).state.accountId,
    ),
    A,
  );
  assert.equal(
    await race.page.evaluate(() => localStorage.getItem("ambrosia_entries")),
    legacy,
  );
  await race.ctx.close();
  console.log(
    "PASS: account B wins over delayed Google A response; switching back to A retains originals.",
  );
  const n = await device({ native: true, required: true });
  await n.page.locator("#auth-google").click();
  await n.page.waitForFunction(() => window.nativeBrowserURL);
  const returnURL = await n.page.evaluate((code) => {
    const back = new URL(
      new URL(window.nativeBrowserURL).searchParams.get("redirect_to"),
    );
    back.searchParams.set("code", code);
    return back.href;
  }, code);
  await n.page.evaluate(() => window.nativeListeners.browserFinished());
  await n.page.waitForFunction(
    () => !localStorage.getItem("ambrosia_google_pkce_v1"),
  );
  await n.page.evaluate(
    (url) => window.nativeListeners.appUrlOpen({ url }),
    returnURL,
  );
  await n.page.waitForTimeout(100);
  assert.equal(n.controls.exchangeCalls, 0);
  await n.page.locator("#auth-google").click();
  await n.page.waitForFunction(() =>
    localStorage.getItem("ambrosia_google_pkce_v1"),
  );
  const coldURL = await n.page.evaluate((code) => {
    const back = new URL(
      new URL(window.nativeBrowserURL).searchParams.get("redirect_to"),
    );
    back.searchParams.set("code", code);
    sessionStorage.setItem("__launch_url", back.href);
    return back.href;
  }, code);
  await n.page.reload();
  await n.page.waitForFunction(() => window.testInstalled);
  await n.page.locator("#ob-continue-account").waitFor();
  assert.equal(n.controls.exchangeCalls, 1);
  assert.equal(await n.page.evaluate(() => window.nativeBrowserClosed), true);
  await n.page.evaluate(
    (url) => window.nativeListeners.appUrlOpen({ url }),
    coldURL,
  );
  await n.page.waitForTimeout(100);
  assert.equal(n.controls.exchangeCalls, 1);
  assert.equal(
    await n.page.evaluate(() => localStorage.getItem("ambrosia_entries")),
    legacy,
  );
  await n.ctx.close();
  console.log(
    "PASS: native cancellation, rejected late callback, persisted cold-start intent and replay protection (bridge fixture only).",
  );
  assert.deepEqual(errors, []);
  console.log("PASS: authentication browser scenarios; screenshots: " + shots);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });

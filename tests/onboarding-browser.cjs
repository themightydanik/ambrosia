const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const rows = new Map();
const backend = require("./browser-backend.cjs")(rows);
let server, browser;
const errors = [];
const wait = async (p, fn) => {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    if (await p.evaluate(fn)) return;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw Error("Timed out: " + fn.toString());
};
(async () => {
  const root = path.resolve("web-dist");
  assert.ok(
    fs.existsSync(path.join(root, "index.html")),
    "Run npm run build first",
  );
  server = http.createServer((req, res) => {
    const file = path.resolve(
      root,
      "." +
        new URL(req.url, "http://test").pathname.replace(/\/$/, "/index.html"),
    );
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.readFile(file, (error, data) => {
      if (error) return res.writeHead(404).end();
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".png")
              ? "image/png"
              : file.endsWith(".woff2")
                ? "font/woff2"
                : "text/html",
      );
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    args: ["--no-sandbox"],
  });
  async function device({
    returning = false,
    legacy = false,
    scheme = "light",
    brokenArt = false,
  } = {}) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: scheme,
    });
    await ctx.addInitScript(
      ({ returning, legacy }) => {
        if (localStorage.getItem("__phase1fixture")) return;
        localStorage.setItem("__phase1fixture", "1");
        if (returning) localStorage.setItem("ambrosia_onboarding_done", "1");
        if (legacy)
          localStorage.setItem(
            "ambrosia_entries",
            JSON.stringify([
              {
                id: 123,
                date: "2026-10-20",
                time: "12:00",
                timestamp: "2026-10-20T12:00Z",
                symptoms: ["headache"],
                triggers: [],
                intensity: 4,
                notes: "Synthetic preserved journal",
                statusUpdates: [],
              },
            ]),
          );
      },
      { returning, legacy },
    );
    await ctx.route("**/api/supabase-config", (r) =>
      r.fulfill({
        json: {
          url: "https://test.supabase.invalid",
          publishableKey: "public-test-only",
        },
      }),
    );
    for (const endpoint of ["ai", "chat", "account-status", "delete-account"])
      await ctx.route("**/api/" + endpoint, (r) => backend.route(r));
    const sdk = fs
      .readFileSync("tests/mock-supabase.js", "utf8")
      .replace(
        "const auth = {",
        `const auth = { async signUp({email,options}) {window.testSignup={email,options};return {data:{session:null,user:null}};},`,
      );
    await ctx.route("https://esm.sh/**", (r) =>
      r.fulfill({ contentType: "application/javascript", body: sdk }),
    );
    await ctx.route("**/__test/**", (r) => {
      const req = r.request(),
        u = new URL(req.url()),
        user = req.headers()["x-test-user"];
      if (u.pathname.endsWith("/page"))
        return r.fulfill({
          json: [...rows.values()].filter((x) => x.user_id === user),
        });
      if (u.pathname.endsWith("/write")) {
        const p = req.postDataJSON();
        assert.equal(p.p_user, user);
        const row = {
          user_id: user,
          id: p.p_id,
          kind: p.p_kind,
          payload: p.p_payload,
          version: 1,
          deleted: p.p_deleted,
          operation_id: p.p_operation,
        };
        rows.set(user + ":" + p.p_id, row);
        return r.fulfill({ json: row });
      }
      return r.fulfill({ json: [] });
    });
    if (brokenArt) await ctx.route("**/ill-onboard-01.png", (r) => r.abort());
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    const images = [];
    page.on("request", (r) => {
      if (r.url().endsWith(".png")) images.push(r.url());
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await wait(page, () => window.testAuth);
    if (!returning) await page.locator("#ob-next-btn").waitFor();
    else await page.locator("#screen-home.active").waitFor();
    return { ctx, page, images };
  }
  const a = await device({ legacy: true });
  const p = a.page;
  await p.locator("[data-illustration] img").evaluate((i) => i.decode());
  await p.evaluate(() => document.fonts.ready);
  assert.deepEqual(
    [...new Set(a.images.map((x) => x.split("/").at(-1)))],
    ["ill-onboard-01.png"],
    "only current scene loads at first launch",
  );
  assert.equal(
    await p.locator("#legacy-fonts").count(),
    0,
    "new welcome does not load the legacy external font stylesheet",
  );
  assert.equal(await p.locator("#ob-back").count(), 0);
  await p.locator("#ob-next-btn").click();
  assert.equal(
    await p.locator("#screen-onboarding").getAttribute("data-step"),
    "2",
  );
  await p.locator("#ob-back").click();
  assert.equal(
    await p.locator("#screen-onboarding").getAttribute("data-step"),
    "1",
  );
  await p.locator("#ob-skip").click();
  assert.equal(
    await p.locator("#screen-onboarding").getAttribute("data-step"),
    "choice",
  );
  assert.equal(
    await p.evaluate(() => localStorage.getItem("ambrosia_onboarding_done")),
    null,
  );
  await p.locator("#ob-back").click();
  assert.equal(
    await p.locator("#screen-onboarding").getAttribute("data-step"),
    "3",
  );
  await p.locator("#ob-next-btn").click();
  assert.equal(
    await p.locator("#screen-onboarding").getAttribute("data-step"),
    "choice",
  );
  console.log(
    "PASS: three slides, Next/Back, Skip and final action reach identical account choice; no early completion.",
  );
  const shots =
    process.env.UPDATE_SCREENSHOTS === "1"
      ? "docs/ambrosia-3/phase1/screenshots"
      : "/tmp/ambrosia-phase1-screenshots";
  fs.mkdirSync(shots, { recursive: true });
  const expected = {
    en: "Your ordinary days matter.",
    uk: "Звичайні дні теж важливі.",
    ru: "Обычные дни тоже важны.",
  };
  for (const lang of ["en", "uk", "ru"]) {
    await p.locator("#ob-language").selectOption(lang);
    for (const theme of ["light", "dark"]) {
      await p.evaluate(async (theme) => {
        (await import("/js/ui/theme.js")).setTheme(theme);
      }, theme);
      for (const width of [320, 375, 390, 430]) {
        await p.setViewportSize({ width, height: 844 });
        // Return from choice to slide 3, then use Back to start, checking all four surfaces.
        if (
          (await p.locator("#screen-onboarding").getAttribute("data-step")) ===
          "choice"
        )
          await p.locator("#ob-back").click();
        while (await p.locator("#ob-back").count())
          await p.locator("#ob-back").click();
        assert.equal(await p.locator("#ob-title").innerText(), expected[lang]);
        for (let step = 1; step <= 4; step++) {
          await p
            .locator("[data-illustration] img")
            .evaluate((i) => i.decode());
          assert.ok(
            await p.evaluate(
              () =>
                document.documentElement.scrollWidth <= innerWidth &&
                document.getElementById("screen-onboarding").scrollWidth <=
                  innerWidth,
            ),
            "no horizontal overflow",
          );
          const box = await p
            .locator(step === 4 ? "#ob-guest" : "#ob-next-btn")
            .boundingBox();
          assert.ok(box.height >= 48, "48px action target");
          if (width === 390 && lang === "en") {
            await p
              .locator("#screen-onboarding")
              .evaluate((n) => (n.scrollTop = 0));
            await p.screenshot({
              path: path.join(
                shots,
                (step === 4 ? "account-choice" : "onboarding-" + step) +
                  "-" +
                  theme +
                  "-390.png",
              ),
            });
          }
          if (step < 4) await p.locator("#ob-next-btn").click();
        }
      }
    }
  }
  console.log(
    "PASS: all slides/account choice at 320/375/390/430, EN/UK/RU, light/dark; screenshots.",
  );
  await p.locator("#ob-language").selectOption("en");
  await p.locator("#ob-email").click();
  await p
    .locator("#welcome-account-form input[type=email]")
    .fill("a@example.test");
  await p
    .locator("#welcome-account-form input[type=password]")
    .fill("fixture-password-only");
  const form = p.locator("#welcome-account-form");
  await form.getByRole("button", { name: "Sign up", exact: true }).click();
  await wait(p, () => !!window.testSignup);
  assert.equal(
    await p.evaluate(() => localStorage.getItem("ambrosia_onboarding_done")),
    null,
  );
  await form
    .getByRole("button", { name: "Send password reset email", exact: true })
    .click();
  await wait(p, () => !!window.testReset);
  await form.locator("input[type=password]").fill("fixture-password-only");
  await form.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.locator("#ob-continue-account").waitFor();
  assert.equal(
    await p.evaluate(
      async () => (await import("/js/state.js")).state.accountId,
    ),
    A,
  );
  assert.equal(
    [...rows.values()].filter((x) => x.kind === "entry" || x.kind === "checkin")
      .length,
    0,
    "no implicit guest upload",
  );
  await p.locator("#ob-continue-account").click();
  await p.locator("#screen-home.active").waitFor();
  assert.equal(
    await p.evaluate(() => localStorage.getItem("ambrosia_onboarding_done")),
    "1",
  );
  assert.ok(
    await p.evaluate(() =>
      localStorage
        .getItem("ambrosia_entries")
        .includes("Synthetic preserved journal"),
    ),
  );
  assert.equal(
    await p
      .getByRole("button", { name: "Continue with Google", exact: true })
      .count(),
    0,
  );
  await p.reload();
  await p.locator("#screen-home.active").waitFor();
  assert.equal(await p.locator("#screen-onboarding.active").count(), 0);
  console.log(
    "PASS: existing email signup confirmation/reset/sign-in, explicit continuation, guest originals preserved, no automatic merge or Google stub.",
  );
  const b = await device({ returning: true, legacy: true });
  assert.equal(b.images.length, 0, "returning users download no Ari art");
  assert.equal(
    await b.page.evaluate(
      async () => (await import("/js/state.js")).state.entries[0].id,
    ),
    123,
  );
  await b.ctx.close();
  const c = await device({ legacy: true, scheme: "dark" });
  assert.equal(
    await c.page.evaluate(() => document.documentElement.dataset.a3Theme),
    "dark",
  );
  await c.page.locator("#ob-theme").click();
  await c.page.locator("#ob-skip").click();
  await c.page.locator("#ob-guest").click();
  await c.page.locator("#screen-home.active").waitFor();
  await c.page.reload();
  await c.page.locator("#screen-home.active").waitFor();
  assert.equal(
    await c.page.evaluate(() => document.documentElement.dataset.a3Theme),
    "light",
  );
  assert.equal(
    await c.page.evaluate(
      async () => (await import("/js/state.js")).state.entries[0].id,
    ),
    123,
  );
  await c.ctx.setOffline(true);
  await c.page.reload();
  await c.page.locator("#screen-home.active").waitFor();
  assert.equal(
    await c.page.evaluate(
      async () => (await import("/js/state.js")).state.entries[0].id,
    ),
    123,
  );
  await c.ctx.close();
  console.log(
    "PASS: returning users bypass onboarding/art, guest journal and completion survive reload/offline, explicit theme persists.",
  );
  const d = await device({ brokenArt: true });
  await wait(
    d.page,
    () =>
      document.querySelector("[data-illustration]").dataset.state ===
      "unavailable",
  );
  await d.page.locator("#ob-next-btn").click();
  assert.equal(
    await d.page.locator("#screen-onboarding").getAttribute("data-step"),
    "2",
  );
  await d.ctx.close();
  const e = await device();
  await e.page.emulateMedia({ reducedMotion: "reduce" });
  await e.page.setViewportSize({ width: 320, height: 640 });
  await e.page
    .locator("#screen-onboarding")
    .evaluate((n) => (n.style.fontSize = "32px"));
  await e.page.addStyleTag({
    content: ".a3-screen h1{font-size:56px}.a3-lead,.a3-button{font-size:32px}",
  });
  await e.page.locator("#ob-next-btn").click();
  assert.ok(
    await e.page.evaluate(
      () =>
        document.getElementById("screen-onboarding").scrollWidth <= innerWidth,
    ),
  );
  assert.equal(
    await e.page
      .locator("#ob-next-btn")
      .evaluate((n) => getComputedStyle(n).transitionDuration),
    "0s",
  );
  await e.ctx.close();
  const slow = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  let configRequest;
  await slow.route("**/api/supabase-config", (route) => {
    configRequest = route;
  });
  const slowPage = await slow.newPage(),
    dialogs = [];
  slowPage.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await slowPage.goto(base, { waitUntil: "domcontentloaded" });
  await slowPage.locator("#ob-language").selectOption("uk");
  await slowPage.locator("#ob-skip").click();
  assert.equal(await slowPage.locator("#ob-guest").isDisabled(), true);
  assert.equal(
    await slowPage.evaluate(() =>
      localStorage.getItem("ambrosia_onboarding_done"),
    ),
    null,
  );
  assert.ok(configRequest);
  await configRequest.fulfill({ json: { url: "", publishableKey: "" } });
  await wait(slowPage, () => !document.getElementById("ob-guest").disabled);
  assert.equal(await slowPage.locator("#ob-language").inputValue(), "uk");
  assert.deepEqual(dialogs, []);
  await slow.close();
  console.log(
    "PASS: initial welcome paints before cloud setup; continuation is gated and language choice survives initialization without premature journal writes.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: missing PNG is nonblocking; reduced motion/large text; no JavaScript errors.",
  );
  await a.ctx.close();
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
    await new Promise((r) => (server ? server.close(r) : r()));
  });

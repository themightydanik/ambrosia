const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
module.exports = async ({ a, backend, wait, base }) => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  await a.page.evaluate(() => window.goTo("upgrade"));
  assert.equal(
    await a.page
      .getByRole("button", { name: "Continue with Google Play" })
      .count(),
    0,
  );
  assert.equal(
    await a.page
      .getByRole("button", { name: "Restore purchases", exact: true })
      .count(),
    0,
  );
  assert.ok(
    (await a.page.locator("#upgrade-content").innerText()).includes("Android"),
  );
  let mode = "success",
    refreshes = 0;
  await a.ctx.route("**/native-config.json", (r) =>
    r.fulfill({ json: { apiOrigin: base } }),
  );
  await a.ctx.route("**/api/billing-session", (r) =>
    r.fulfill({
      json: {
        userId: A,
        appUserId: "rc_" + A,
        publicKey: "goog_fixture",
        products: ["fixture_month", "fixture_year"],
        offering: "fixture",
      },
    }),
  );
  // A real SDK/store cannot run in Chromium. Only this module is a clearly simulated bridge.
  await a.ctx.route("**/js/native-sdk.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: `
 let id;window.billingFixture={calls:[],mode:'success'};
 export const Purchases={
 configure:async c=>{id=c.appUserID;window.billingFixture.calls.push('configure:'+id)},
 logIn:async c=>{id=c.appUserID;window.billingFixture.calls.push('login:'+id)},
 getAppUserID:async()=>({appUserID:id}),
 getOfferings:async()=>({all:{fixture:{availablePackages:['MONTHLY','ANNUAL'].map((type,i)=>({packageType:type,product:{defaultOption:{id:'base',productId:i?'fixture_year':'fixture_month',isBasePlan:true,isPrepaid:false,installmentsInfo:null,billingPeriod:{iso8601:i?'P1Y':'P1M'},fullPricePhase:{recurrenceMode:1},pricingPhases:[{recurrenceMode:1,price:{formatted:i?'€49,99':'€5,49'},billingPeriod:{iso8601:i?'P1Y':'P1M'}}]}}}))}}}),
 purchaseSubscriptionOption:async()=>{window.billingFixture.calls.push('purchase:'+id);if(window.billingFixture.mode==='cancel')throw {userCancelled:true};if(window.billingFixture.mode==='hold')await new Promise(resolve=>window.billingFixture.release=resolve);return {customerInfo:{entitlements:{active:{fake:true}}}};},
 restorePurchases:async()=>{window.billingFixture.calls.push('restore:'+id);return {};}
 };export const App={addListener:()=>{}};export const Browser={open:async()=>{}};
 `,
    }),
  );
  await a.ctx.route("**/api/billing-refresh", async (r) => {
    refreshes++;
    if (mode === "outage")
      return r.fulfill({
        status: 503,
        json: { error: "BILLING_VERIFICATION_UNAVAILABLE" },
      });
    if (mode === "success") backend.tiers.set(A, "premium");
    return r.fulfill({ json: { confirmed: true } });
  });
  await a.page.evaluate(() => {
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
    };
    window.goTo("upgrade");
  });
  await a.page
    .getByRole("button", { name: "Continue with Google Play", exact: true })
    .first()
    .waitFor();
  assert.ok(
    (await a.page.locator("#upgrade-content").innerText()).includes("€5,49"),
  );
  const shotDir =
    process.env.UPDATE_SCREENSHOTS === "1"
      ? "docs/screenshots"
      : path.join(os.tmpdir(), "ambrosia-mobile-screenshots");
  fs.mkdirSync(shotDir, { recursive: true });
  await a.page.setViewportSize({ width: 390, height: 844 });
  await wait(a.page,()=>!document.querySelector('#app-toast.visible'));
  await a.page.locator('.purchase-plan').first().scrollIntoViewIfNeeded();
  await a.page.screenshot({
    path: path.join(shotDir, "premium-plans-390.png"),
    fullPage: true,
  });
  await a.page.evaluate(() => (window.billingFixture.mode = "cancel"));
  await a.page
    .getByRole("button", { name: "Continue with Google Play", exact: true })
    .first()
    .click();
  await wait(a.page, () =>
    document
      .querySelector(".billing-notice")
      .textContent.includes("Purchase cancelled"),
  );
  assert.equal(refreshes, 0);
  mode = "outage";
  await a.page.evaluate(() => (window.billingFixture.mode = "success"));
  await a.page
    .getByRole("button", { name: "Continue with Google Play", exact: true })
    .first()
    .click();
  await wait(a.page, () =>
    document.querySelector(".billing-notice").textContent.includes("pending"),
  );
  assert.equal(
    await a.page.evaluate(async () =>
      (await import("/js/premium.js")).isPremium(),
    ),
    false,
    "SDK success cannot grant entitlement",
  );
  assert.equal(
    await a.page
      .getByRole("button", { name: "Continue with Google Play", exact: true })
      .first()
      .isDisabled(),
    true,
  );
  mode = "success";
  await a.page
    .getByRole("button", { name: "Restore purchases", exact: true })
    .click();
  await wait(a.page, () =>
    document
      .querySelector(".billing-notice")
      .textContent.includes("Premium confirmed"),
  );
  assert.equal(
    await a.page.evaluate(async () =>
      (await import("/js/premium.js")).isPremium(),
    ),
    true,
  );
  const dir = path.join(os.tmpdir(), "ambrosia-mobile-screenshots");
  fs.mkdirSync(dir, { recursive: true });
  await a.page.setViewportSize({ width: 390, height: 844 });
  await a.page.screenshot({
    path: path.join(dir, "premium-390.png"),
    fullPage: true,
  });
  backend.tiers.delete(A);
  await a.page.evaluate(async () => {
    await (await import("/js/account-access.js")).refreshAccess(true);
    window.billingFixture.mode = "hold";
  });
  await a.page
    .getByRole("button", { name: "Continue with Google Play", exact: true })
    .first()
    .click();
  await wait(a.page, () => !!window.billingFixture.release);
  const before = refreshes;
  await a.page.evaluate(
    (B) => window.testAuth.setUser({ id: B, email: "b@example.test" }),
    B,
  );
  await a.page.evaluate(() => window.billingFixture.release());
  await wait(
    a.page,
    async () =>
      (await import("/js/state.js")).state.accountId ===
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  assert.equal(
    refreshes,
    before,
    "late purchase cannot verify for switched account",
  );
  await a.page.evaluate(() => (window.Capacitor = undefined));
  await a.page.evaluate(
    (A) => window.testAuth.setUser({ id: A, email: "a@example.test" }),
    A,
  );
  await wait(
    a.page,
    async () =>
      (await import("/js/state.js")).state.accountId ===
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );
  await a.page.evaluate(() => window.goTo("home"));
  console.log(
    "PASS billing browser: web/native separation, store prices, cancellation, unverified success rejection, network recovery/restore and account-switch isolation",
  );
};

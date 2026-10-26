const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
module.exports = async ({ a, b, rows, backend, wait }) => {
  const screenshotDir =
    process.env.UPDATE_SCREENSHOTS === "1"
      ? "docs/screenshots"
      : path.join(os.tmpdir(), "ambrosia-mobile-screenshots");
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const synced = (p) =>
    wait(p, async () => {
      const s = (await import("/js/sync/runtime.js")).syncStatus();
      return s.phase === "synced" && !s.pending;
    });
  const setScale = async (p, n = 4) => {
    for (let i = 0; i < 4; i++)
      await p
        .locator(".scale-field")
        .nth(i)
        .locator('[data-value="' + n + '"]')
        .click();
  };
  await a.page.evaluate(() => window.goTo("home"));
  await a.page.locator("#home-checkin").click();
  await setScale(a.page);
  await a.page.locator(".optional-note summary").click();
  await a.page.locator("#checkin-note").fill("A steady, healthy day.");
  await a.page.locator("#checkin-save").click();
  await wait(
    a.page,
    async () => (await import("/js/state.js")).state.checkins.length === 1,
  );
  await synced(a.page);
  const firstId = await a.page.evaluate(
    async () => (await import("/js/state.js")).state.checkins[0].id,
  );
  await a.page.locator("#home-checkin").click();
  await a.page
    .locator(".scale-field")
    .nth(1)
    .locator('[data-value="5"]')
    .click();
  await a.page.locator("#checkin-save").click();
  await synced(a.page);
  assert.equal(
    await a.page.evaluate(
      async () => (await import("/js/state.js")).state.checkins[0].id,
    ),
    firstId,
  );
  assert.equal(
    [...rows.values()].filter((r) => r.kind === "checkin" && !r.deleted).length,
    1,
  );
  await b.page.evaluate(
    (A) => window.testAuth.setUser({ id: A, email: "a@example.test" }),
    A,
  );
  await b.page.evaluate(() => window.goTo("settings"));
  await b.page
    .getByRole("button", { name: "Sync now / retry", exact: true })
    .click();
  await wait(
    b.page,
    async () => (await import("/js/state.js")).state.checkins.length === 1,
  );
  await a.ctx.setOffline(true);
  await a.page.evaluate(async () => {
    const { openCheckin } = await import("/js/screens/checkin.js");
    const { localDay, shiftDay } = await import("/js/wellness/model.js");
    openCheckin(shiftDay(localDay(), -1));
  });
  await setScale(a.page, 3);
  await a.page.locator("#checkin-save").click();
  await wait(
    a.page,
    async () => (await import("/js/state.js")).state.checkins.length === 2,
  );
  await a.page.reload({ waitUntil: "domcontentloaded" });
  await wait(
    a.page,
    async () => (await import("/js/state.js")).state.checkins.length === 2,
  );
  await a.ctx.setOffline(false);
  await synced(a.page);
  console.log(
    "PASS wellness browser: daily creation/edit/dedup, second device, offline check-in/reload/reconnect",
  );
  await a.page.evaluate(() => window.goTo("history"));
  await a.page
    .getByRole("tab", { name: "Symptom episodes", exact: true })
    .click();
  await a.page
    .getByRole("button", { name: "New episode", exact: false })
    .click();
  await a.page.locator("#episode-title").fill("Recovery notes");
  await a.page.locator("#episode-status").selectOption("recovering");
  await a.page.locator("#screen-episode button[type=submit]").click();
  await synced(a.page);
  const episodeId = await a.page.evaluate(
    async () => (await import("/js/state.js")).state.episodes[0].id,
  );
  await a.page.evaluate(() => {
    window.goTo("log");
    window.setLogMode("quick");
  });
  await a.page.locator(".cat-btn").first().click();
  await a.page.locator(".sym-btn").first().click();
  await a.page.locator("#log-extra summary").click();
  await a.page.locator("#symptom-episode").selectOption(episodeId);
  await a.page.locator("#log-notes").fill("Recovery observation");
  await a.page.locator("#log-save-btn").click();
  await synced(a.page);
  await a.page.evaluate(
    async (id) => (await import("/js/screens/episode.js")).openEpisode(id),
    episodeId,
  );
  await a.page.locator("#episode-status").selectOption("recovered");
  await a.page
    .locator("#episode-end")
    .fill(
      await a.page.evaluate(async () =>
        (await import("/js/wellness/model.js")).localDay(),
      ),
    );
  await a.page.locator("#screen-episode button[type=submit]").click();
  await synced(a.page);
  assert.equal(
    await a.page.evaluate(
      async () => (await import("/js/state.js")).state.episodes[0].status,
    ),
    "recovered",
  );
  await a.page.evaluate(() => {
    window.historySetFilter(null);
    window.goTo("history");
  });
  await a.page
    .getByRole("tab", { name: "Trends & insights", exact: true })
    .click();
  assert.ok(
    (await a.page.locator("#screen-history").innerText()).includes(
      "14 earlier",
    ),
  );
  await a.page.evaluate(() => {
    window.goTo("history");
  });
  await a.page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await a.page
    .locator("#history-list .entry-card")
    .filter({ hasText: "Recovery observation" })
    .click();
  await a.page.locator("#entry-to-chat").click();
  assert.equal(await a.page.locator("#chat-question").count(), 1);
  const currentId = await a.page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          "ambrosia_chat_v1:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ),
      ).active,
  );
  backend.setChatAnswer(
    "You recorded a recovery observation today [S1]. Your check-ins are still sparse, so there is no reliable personal baseline yet. Consider noting how you feel tomorrow. This is a description of your records, not a medical conclusion.",
  );
  const before = JSON.stringify([...rows.values()]);
  await a.page
    .locator("#chat-question")
    .fill("Help me reflect on this episode.");
  await a.page.locator("#chat-send").click();
  await wait(
    a.page,
    () => document.querySelectorAll(".chat-message.assistant").length === 1,
  );
  assert.equal(
    JSON.stringify([...rows.values()]),
    before,
    "assistant must not mutate journal records",
  );
  assert.ok(
    !JSON.stringify(backend.transcripts.at(-1)).includes(
      "Recovery observation",
    ),
    "notes excluded by default",
  );
  await a.page.locator("#chat-question").fill("What information is missing?");
  await a.page.locator("#chat-send").click();
  await wait(
    a.page,
    () => document.querySelectorAll(".chat-message.assistant").length === 2,
  );
  assert.ok(
    backend.transcripts
      .at(-1)
      .messages.some((m) => m.content === "Help me reflect on this episode."),
  );
  backend.failChat();
  await a.page
    .locator("#chat-question")
    .fill("A question that must survive failure");
  await a.page.locator("#chat-send").click();
  await wait(a.page, () =>
    document.querySelector("[data-message-state=failed]"),
  );
  assert.ok(
    [...backend.messages.values()].some(
      (m) => m.state === "failed" && m.content.includes("must survive"),
    ),
  );
  await a.page
    .locator("[data-message-state=failed]")
    .getByRole("button", { name: "Retry as a new attempt" })
    .click();
  await wait(
    a.page,
    () => document.querySelectorAll(".chat-message.assistant").length === 3,
  );
  assert.equal(backend.chatUsed.get(A), 4);
  assert.equal(backend.used.get(A), 3, "chat must not consume report quota");
  await a.page
    .locator(".chat-message.assistant .source-button")
    .first()
    .click();
  await a.page.locator("#entry-modal.active").waitFor();
  await a.page.evaluate(() => window.closeEntryModal());
  a.page.removeAllListeners("dialog");
  a.page.once("dialog", (d) => d.accept("My recovery conversation"));
  await a.page
    .locator(".chat-actions")
    .getByRole("button", { name: "Rename", exact: true })
    .click();
  a.page.on("dialog", (d) => d.accept());
  await wait(
    a.page,
    () =>
      document.querySelector("#companion-content h1")?.textContent ===
      "My recovery conversation",
  );
  await b.page.evaluate(() => window.goTo("ai"));
  await wait(
    b.page,
    () =>
      document.querySelector(".conversation-item")?.textContent ===
      "My recovery conversation",
  );
  await b.page.evaluate(
    (B) => window.testAuth.setUser({ id: B, email: "b@example.test" }),
    B,
  );
  await b.page.evaluate(() => window.goTo("ai"));
  assert.ok(
    !(await b.page.locator("#companion-content").innerText()).includes(
      "My recovery conversation",
    ),
  );
  assert.equal(
    await b.page.evaluate(
      async () => (await import("/js/state.js")).state.checkins.length,
    ),
    0,
  );
  console.log(
    "PASS companion browser: entry-to-chat, multi-turn history, source links, failed-message retry, separate quotas, rename and account isolation",
  );
  await a.page.locator("#chat-context > summary").click();
  const exported = await Promise.all([
    a.page.waitForEvent("download"),
    a.page
      .locator("#chat-context")
      .getByRole("button", { name: "MD", exact: true })
      .click(),
  ]);
  assert.equal(exported[0].suggestedFilename(), "ambrosia-context.md");
  const markdown = fs.readFileSync(await exported[0].path(), "utf8");
  assert.ok(markdown.includes("Selected:"));
  assert.ok(!markdown.includes("Recovery observation"));
  await a.page.locator("#chat-context > summary").click();
  // Reproducible mobile screenshots of real UI using clearly synthetic observations.
  await a.page.setViewportSize({ width: 390, height: 844 });
  fs.mkdirSync(screenshotDir, { recursive: true });
  await a.page.screenshot({
    path: path.join(screenshotDir, "companion-390.png"),
  });
  await a.page.evaluate(async () => {
    const { saveWellness } = await import("/js/sync/runtime.js");
    const { makeCheckin, localDay, shiftDay } =
      await import("/js/wellness/model.js");
    for (let i = 2; i < 24; i++) {
      const c = await makeCheckin(shiftDay(localDay(), -i), {
        feeling: [3, 4, 4, 5, 3][i % 5],
        mood: 4,
        energy: 3 + (i % 3),
        sleep: 2 + (i % 4),
        note: "",
      });
      saveWellness("checkin", c);
    }
  });
  await synced(a.page);
  for (const width of [320, 375, 390, 430]) {
    await a.page.setViewportSize({ width, height: 844 });
    for (const screen of [
      "home",
      "history",
      "ai",
      "settings",
      "checkin",
      "episode",
      "log",
      "onboarding",
      "upgrade",
    ]) {
      await a.page.evaluate((screen) => window.goTo(screen), screen);
      await a.page.waitForTimeout(80);
      const overflow = await a.page.evaluate(() => ({
        app: document.getElementById("app").scrollWidth,
        width: document.getElementById("app").clientWidth,
        body: document.body.scrollWidth,
        viewport: innerWidth,
      }));
      assert.ok(
        overflow.app <= overflow.width + 1 &&
          overflow.body <= overflow.viewport,
        `${screen} horizontal overflow at ${width}: ${JSON.stringify(overflow)}`,
      );
    }
  }
  await a.page.setViewportSize({ width: 390, height: 844 });
  await a.page.evaluate(() => window.goTo("home"));
  await a.page.screenshot({ path: path.join(screenshotDir, "home-390.png") });
  await a.page.locator("#home-checkin").click();
  await a.page.screenshot({
    path: path.join(screenshotDir, "checkin-390.png"),
  });
  await a.page.evaluate(() => {
    window.goTo("history");
  });
  await a.page.getByRole("tab", { name: "Calendar", exact: true }).click();
  await a.page.screenshot({
    path: path.join(screenshotDir, "history-390.png"),
  });
  for (const lang of ["uk", "ru", "en"]) {
    await a.page.evaluate((lang) => window.setLang(lang), lang);
    await a.page.evaluate(() => window.goTo("home"));
    const text = await a.page.locator("#screen-home").innerText();
    assert.ok(
      text.includes(
        lang === "uk"
          ? "Трохи турботи"
          : lang === "ru"
            ? "Немного заботы"
            : "A little care",
      ),
    );
    await a.page.locator("#home-checkin").click();
    assert.equal(await a.page.locator(".scale-field").count(), 4);
    assert.equal(
      await a.page.evaluate(() => document.documentElement.lang),
      lang,
    );
  }
  console.log(
    "PASS product browser: selected Markdown export, statistical baseline, EN/UK/RU, 320/375/390/430px layout and mobile screenshots",
  );
  await a.page.evaluate(() => window.goTo("ai"));
  await a.page
    .locator(".chat-actions")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  assert.equal(backend.conversations.get(A + currentId).deleted, true);
  assert.ok(
    ![...backend.messages.values()].some(
      (m) => m.conversation_id === currentId,
    ),
  );
  await a.ctx.setOffline(true);
  await a.page.locator("#new-chat").click();
  await a.page.locator("#chat-question").fill("Offline draft retained");
  const providerCalls = backend.providerCalls;
  await a.page.locator("#chat-send").click();
  assert.equal(backend.providerCalls, providerCalls);
  await a.page.reload({ waitUntil: "domcontentloaded" });
  await wait(
    a.page,
    async () => (await import("/js/state.js")).state.accountId !== null,
  );
  await a.page.evaluate(() => window.goTo("ai"));
  assert.equal(
    await a.page.locator("#chat-question").inputValue(),
    "Offline draft retained",
  );
  await a.ctx.setOffline(false);
  await synced(a.page);
  assert.equal(backend.providerCalls, providerCalls);
  await a.page
    .locator(".chat-actions")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  console.log(
    "PASS companion browser: conversation deletion and offline draft/reload without automatic transmission",
  );
};

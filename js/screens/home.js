import { el, button } from "../wellness/dom.js";
import { v, locale } from "../wellness/copy.js";
import { localDay, statistics, DIMENSIONS } from "../wellness/model.js";
import { trendChart } from "../wellness/charts.js";
import { openCheckin } from "./checkin.js";
import { goTo } from "../navigation.js";
import { state } from "../state.js";
import { escapeHTML } from "../utils/escape.js";
import { t } from "../i18n.js";
import { SYMPTOM_COLORS, STATUS_COLORS } from "../data.js";
import { registerScreen } from "../navigation.js";

// [entryCardHTML и все другие функции остаются без изменений]
export function entryCardHTML(entry, updates = []) {
  const localeMap = { en: "en-US", ru: "ru-RU", uk: "uk-UA" };
  const locale = localeMap[state.lang] || "en-US";

  const date = new Date(entry.date + "T12:00").toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = entry.time ? ` · ${escapeHTML(entry.time)}` : "";

  const color =
    entry.intensity < 4
      ? "var(--mint)"
      : entry.intensity < 7
        ? "var(--gold)"
        : "var(--coral)";

  const symsHTML = entry.symptoms
    .map(
      (s) => `<div class="entry-chip">
      <div class="entry-chip-dot" style="background:${SYMPTOM_COLORS[s] || "#888"}"></div>${escapeHTML(t(s))}
    </div>`,
    )
    .join("");

  const trigsHTML = entry.triggers.length
    ? `<div class="entry-triggers">${entry.triggers.map((tr) => `<div class="trig-tag">⚡ ${escapeHTML(t(tr))}</div>`).join("")}</div>`
    : "";

  const notesHTML = entry.notes
    ? `<div class="entry-notes">"${escapeHTML(entry.notes)}"</div>`
    : "";

  const statusHistory = entry.statusUpdates || [];
  const updatesHTML = statusHistory.length
    ? `<div class="entry-timeline">
        ${statusHistory
          .map((u) => {
            const uDate = new Date(u.date + "T12:00").toLocaleDateString(
              locale,
              { month: "short", day: "numeric" },
            );
            const uTime = u.time ? ` · ${escapeHTML(u.time)}` : "";
            const statusColor = STATUS_COLORS[u.status] || "#888";
            const statusKey =
              "status" +
              u.status.charAt(0).toUpperCase() +
              u.status.slice(1) +
              "Short";
            return `<div class="entry-timeline-item">
            <div class="entry-timeline-dot" style="background:${statusColor}"></div>
            <div class="entry-timeline-text">
              <span class="entry-timeline-date">${uDate}${uTime}</span>
              <span class="entry-timeline-status" style="color:${statusColor}">${escapeHTML(t(statusKey))}</span>
              ${u.notes ? `<span class="entry-timeline-note">"${escapeHTML(u.notes)}"</span>` : ""}
            </div>
          </div>`;
          })
          .join("")}
      </div>`
    : "";

  const criticalIndicator = entry.criticalTracking
    ? `<div class="critical-indicator" title="${t("criticalTrackingActive")}">
        <div class="critical-pulse"></div>
      </div>`
    : "";

  if (entry.isUpdate) {
    const statusColor = STATUS_COLORS[entry.updateStatus] || "#888";
    const statusKey =
      "status" +
      entry.updateStatus.charAt(0).toUpperCase() +
      entry.updateStatus.slice(1) +
      "Short";
    return `<div class="entry-card entry-card--update" onclick="openEntryModal(${escapeHTML(JSON.stringify(entry.id))})">
      <div class="entry-date-bar">
        <div class="entry-date-text">
          <span class="update-badge">↻ ${t("updateLabel")}</span>
          ${date}${timeStr}
        </div>
        <div style="color:${statusColor};font-size:13px;font-weight:600">${escapeHTML(t(statusKey))}</div>
      </div>
      <div class="entry-body">
        <div class="entry-symptoms">${symsHTML}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <div class="intensity-mini-bar" style="background:${color}"></div>
          <span style="font-size:12px;color:var(--cream60)">${t("intensityLabel")} ${escapeHTML(entry.intensity)}/10</span>
        </div>
        ${notesHTML}
      </div>
    </div>`;
  }

  return `<div class="entry-card" onclick="openEntryModal(${escapeHTML(JSON.stringify(entry.id))})">
    <div class="entry-date-bar">
      <div class="entry-date-text">${date}${timeStr}</div>
      <div style="display:flex;align-items:center;gap:8px">
        ${criticalIndicator}
        <div class="entry-severity" style="color:${color}">${t("intensityLabel")} ${escapeHTML(entry.intensity)}/10</div>
      </div>
    </div>
    <div class="entry-body">
      <div class="entry-symptoms">${symsHTML}</div>
      ${trigsHTML}${notesHTML}
      ${updatesHTML}
    </div>
  </div>`;
}

export function renderHome() {
  const root = document.getElementById("screen-home");
  root.replaceChildren();
  const today = localDay(),
    checkin = state.checkins.find((c) => c.date === today),
    summary = statistics(state.checkins, state.entries, { end: today });
  const dateLabel = new Date(today + "T12:00").toLocaleDateString(locale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  root.append(
    el(
      "header",
      { class: "page-head home-head" },
      el(
        "div",
        { class: "brand-line" },
        el("span", { class: "brand-mark" }, "✳"),
        el("span", {}, "AMBROSIA"),
        button(state.profile.avatar || "🌿", () => goTo("settings"), {
          "aria-label": v("profile"),
          class: "avatar-button",
        }),
      ),
      el("p", { class: "eyebrow" }, dateLabel),
      el("h1", {}, v("greeting")),
    ),
  );
  const hero = el(
    "section",
    { class: "checkin-hero" },
    el("div", { class: "hero-orbit", "aria-hidden": "true" }, "◕"),
    el("p", { class: "eyebrow" }, v("checkin")),
    el("h2", {}, checkin ? v("checkinDone") : v("healthy")),
    el("p", { class: "muted" }, v("checkinSub")),
  );
  if (checkin)
    hero.append(
      el(
        "div",
        { class: "metric-row" },
        ...DIMENSIONS.map((k) =>
          el(
            "div",
            {},
            el("strong", {}, String(checkin[k])),
            el("span", {}, v(k)),
          ),
        ),
      ),
    );
  hero.append(
    button(checkin ? v("edit") : v("checkinNow"), () => openCheckin(today), {
      class: "btn-primary",
      id: "home-checkin",
    }),
  );
  root.append(hero);
  root.append(
    el(
      "div",
      { class: "action-pair" },
      button(
        "+ " + v("log"),
        () => {
          state.logMode = "quick";
          goTo("log");
        },
        { id: "ht-log" },
      ),
      button("✧ " + v("chatTitle"), () =>
        window.startContextChat({ period: "7" }),
      ),
    ),
  );
  const chart = el(
    "section",
    { class: "wellness-card" },
    el(
      "div",
      { class: "section-line" },
      el("h2", {}, v("week")),
      el("span", { class: "count-pill" }, summary.observedDays + "/7"),
    ),
    trendChart(state.checkins, "feeling", today),
    el(
      "p",
      { class: "muted" },
      summary.observedDays < 3 ? v("sparse") : v("missing"),
    ),
  );
  chart.append(
    el(
      "div",
      { class: "metric-row" },
      ...DIMENSIONS.map((k) =>
        el(
          "div",
          {},
          el("strong", {}, summary.dimensions[k].mean ?? "—"),
          el("span", {}, v(k)),
        ),
      ),
    ),
    button(v("insights") + " →", () => {
      state.historyTab = "insights";
      state.historyDay = null;
      goTo("history");
    }),
  );
  root.append(chart);
  const base = el(
    "section",
    { class: "baseline-note" },
    el("span", { "aria-hidden": "true" }, "⌁"),
    el(
      "div",
      {},
      el("h3", {}, v("baseline")),
      el(
        "p",
        { class: "muted" },
        summary.dimensions.feeling.baseline === null
          ? v("baselineNeed")
          : v("feeling") +
              ": " +
              summary.dimensions.feeling.baseline +
              "/5 · " +
              summary.dimensions.feeling.baselineCount +
              " " +
              v("observed"),
      ),
    ),
  );
  root.append(base);
  const recent = el(
    "section",
    { class: "recent-section" },
    el(
      "div",
      { class: "section-line" },
      el("h2", {}, v("recent")),
      button(
        v("viewHistory"),
        () => {
          state.historyTab = "calendar";
          goTo("history");
        },
        { id: "ht-all" },
      ),
    ),
  );
  const list = el("div", { id: "home-recent" });
  const entries = state.entries
    .filter((e) => !e.isUpdate)
    .slice(-2)
    .reverse();
  if (entries.length)
    list.innerHTML = entries.map((e) => entryCardHTML(e)).join("");
  else list.append(el("p", { class: "empty-message" }, v("empty")));
  recent.append(list);
  root.append(recent);
  root.append(el("p", { class: "page-footnote" }, v("privacy")));
}
registerScreen("home", renderHome);

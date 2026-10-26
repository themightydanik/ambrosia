import { state } from "../state.js";
import { registerScreen } from "../navigation.js";
import { t } from "../i18n.js";
import { isLocked, showPaywall, isPremium } from "../premium.js";
import { entryCardHTML } from "./home.js";
import { el, button, field } from "../wellness/dom.js";
import { v, locale } from "../wellness/copy.js";
import {
  localDay,
  shiftDay,
  statistics,
  DIMENSIONS,
  episodeEntries,
} from "../wellness/model.js";
import { trendChart } from "../wellness/charts.js";
import { openCheckin } from "./checkin.js";
import { openEpisode } from "./episode.js";
let month;
export function renderHistory() {
  const root = document.getElementById("screen-history");
  root.replaceChildren();
  const tab = state.historyTab || "calendar";
  root.append(
    el(
      "header",
      { class: "page-head" },
      el("p", { class: "eyebrow" }, v("history")),
      el("h1", {}, v(tab)),
    ),
  );
  const tabs = el("div", {
    class: "segmented",
    role: "tablist",
    "aria-label": v("history"),
  });
  for (const name of ["calendar", "insights", "episodes"])
    tabs.append(
      button(
        v(name),
        () => {
          state.historyTab = name;
          renderHistory();
        },
        { role: "tab", "aria-selected": String(tab === name) },
      ),
    );
  root.append(tabs);
  if (tab === "insights") {
    renderInsights(root);
    return;
  }
  if (tab === "episodes") {
    renderEpisodes(root);
    return;
  }
  const today = localDay();
  month = month || today.slice(0, 7);
  const first = new Date(month + "-01T12:00"),
    count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const calendar = el("section", { class: "wellness-card calendar-card" }),
    head = el(
      "div",
      { class: "section-line" },
      button(
        "‹",
        () => {
          first.setMonth(first.getMonth() - 1);
          month = localDay(first).slice(0, 7);
          renderHistory();
        },
        { "aria-label": v("previous") },
      ),
      el(
        "h2",
        {},
        first.toLocaleDateString(locale(), { month: "long", year: "numeric" }),
      ),
      button(
        "›",
        () => {
          first.setMonth(first.getMonth() + 1);
          month = localDay(first).slice(0, 7);
          renderHistory();
        },
        { "aria-label": v("next") },
      ),
    );
  calendar.append(head);
  const grid = el("div", {
    class: "calendar-grid",
    role: "group",
    "aria-label": v("calendar"),
  });
  for (let i = 0; i < 7; i++)
    grid.append(
      el(
        "span",
        { class: "weekday" },
        new Date(2026, 0, 5 + i).toLocaleDateString(locale(), {
          weekday: "narrow",
        }),
      ),
    );
  for (let i = 0; i < (first.getDay() + 6) % 7; i++)
    grid.append(el("span", { "aria-hidden": "true" }));
  for (let d = 1; d <= count; d++) {
    const day = month + "-" + String(d).padStart(2, "0"),
      checkin = state.checkins.find((c) => c.date === day),
      observations = state.entries.some((e) => e.date === day && !e.isUpdate);
    grid.append(
      button(
        String(d),
        () => {
          state.historyDay = state.historyDay === day ? null : day;
          renderHistory();
        },
        {
          class:
            "calendar-day" +
            (day === today ? " is-today" : "") +
            (state.historyDay === day ? " is-selected" : ""),
          "aria-label":
            day +
            (checkin ? " · " + v("checkin") : "") +
            (observations ? " · " + v("symptoms") : ""),
          "data-observed": String(!!checkin || observations),
          "aria-pressed": String(state.historyDay === day),
        },
      ),
    );
  }
  calendar.append(grid);
  root.append(calendar);
  const day = state.historyDay,
    detail = el(
      "section",
      { class: "day-detail" },
      el(
        "div",
        { class: "section-line" },
        el("h2", {}, day || v("recent")),
        day
          ? button(v("all"), () => {
              state.historyDay = null;
              renderHistory();
            })
          : null,
      ),
    );
  if (day) {
    const c = state.checkins.find((c) => c.date === day);
    detail.append(
      button(c ? v("edit") + " · " + v("checkin") : v("checkin"), () =>
        openCheckin(day),
      ),
    );
    if (c)
      detail.append(
        el(
          "div",
          { class: "metric-row" },
          ...DIMENSIONS.map((k) =>
            el("div", {}, el("strong", {}, c[k] + "/5"), el("span", {}, v(k))),
          ),
        ),
        el("p", { class: "record-note" }, c.note),
      );
  }
  const filters = el("div", { id: "history-filter", class: "filter-chips" });
  const symptoms = [
    ...new Set(
      state.entries.filter((e) => !e.isUpdate).flatMap((e) => e.symptoms),
    ),
  ];
  filters.append(
    button(v("all"), () => historySetFilter(null), {
      "aria-pressed": String(!state.historyFilter),
    }),
  );
  for (const s of symptoms)
    filters.append(
      button(
        t(s) + (isLocked("filter") ? " · PRO" : ""),
        () =>
          isLocked("filter") ? showPaywall("filter") : historySetFilter(s),
        { "aria-pressed": String(state.historyFilter === s) },
      ),
    );
  detail.append(filters);
  const list = el("div", { id: "history-list" });
  let entries = state.entries.filter(
    (e) => !e.isUpdate && (!day || e.date === day),
  );
  if (state.historyFilter && !isLocked("filter"))
    entries = entries.filter((e) => e.symptoms.includes(state.historyFilter));
  entries = [...entries].reverse();
  if (entries.length)
    list.innerHTML = entries.map((e) => entryCardHTML(e)).join("");
  else
    list.append(
      el("p", { class: "empty-message" }, day ? v("dayEmpty") : v("empty")),
    );
  detail.append(list);
  detail.append(
    button(v("chatFrom"), () =>
      window.startContextChat(
        day
          ? { period: "all", startDate: day, endDate: day }
          : state.historyFilter
            ? { period: "all", symptoms: [state.historyFilter] }
            : { period: "30" },
      ),
    ),
  );
  root.append(detail);
}
function renderInsights(root) {
  const end = state.historyDay || localDay(),
    summary = statistics(state.checkins, state.entries, { end }),
    weekly = el(
      "section",
      { class: "wellness-card" },
      el("p", { class: "eyebrow" }, v("week")),
      el("h2", {}, summary.observedDays + "/7 " + v("observed")),
      el("p", { class: "muted" }, v("missing")),
    );
  for (const k of DIMENSIONS) {
    const metric = summary.dimensions[k];
    weekly.append(
      el(
        "div",
        { class: "section-line" },
        el("h3", {}, v(k)),
        el("strong", {}, metric.mean === null ? "—" : metric.mean + "/5"),
      ),
      trendChart(state.checkins, k, end),
      el(
        "p",
        { class: "muted" },
        metric.baseline === null
          ? v("baselineNeed")
          : v("baseline") +
              ": " +
              metric.baseline +
              "/5 · Δ " +
              (metric.difference > 0 ? "+" : "") +
              metric.difference,
      ),
    );
  }
  weekly.append(
    el(
      "p",
      { class: "muted" },
      v("symptoms") +
        ": " +
        summary.symptomEntries +
        " · " +
        summary.symptomDays +
        "/" +
        summary.days +
        " " +
        v("days"),
    ),
    el("p", { class: "muted" }, v("descriptive")),
    button(v("chatFrom"), () =>
      window.startContextChat({ period: "7", endDate: end }),
    ),
  );
  root.append(weekly);
  const longer = el(
    "section",
    { class: "wellness-card" },
    el("h2", {}, v("longitudinal")),
  );
  if (isPremium()) {
    const current = statistics(state.checkins, state.entries, {
        end,
        days: 90,
      }),
      previous = statistics(state.checkins, state.entries, {
        end: shiftDay(end, -90),
        days: 90,
      });
    for (const k of DIMENSIONS)
      longer.append(
        el(
          "p",
          {},
          v(k) +
            ": " +
            (current.dimensions[k].mean ?? "—") +
            " / " +
            (previous.dimensions[k].mean ?? "—") +
            " · " +
            v("vs"),
        ),
        el(
          "p",
          { class: "muted" },
          current.dimensions[k].count +
            " / " +
            previous.dimensions[k].count +
            " " +
            v("observed"),
        ),
      );
  } else
    longer.append(
      el("p", { class: "muted" }, v("premiumInsights")),
      button("Premium", () => showPaywall("general")),
    );
  root.append(longer);
}
function renderEpisodes(root) {
  root.append(
    button("+ " + v("newEpisode"), () => openEpisode(), {
      class: "btn-primary",
    }),
  );
  if (!state.episodes.length)
    root.append(el("p", { class: "empty-message" }, v("episodeHint")));
  for (const e of [...state.episodes].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  )) {
    const card = el(
      "section",
      { class: "wellness-card" },
      el("p", { class: "eyebrow" }, v(e.status)),
      el("h2", {}, e.title),
      el(
        "p",
        { class: "muted" },
        e.startDate +
          " — " +
          (e.endDate || v("ongoing")) +
          " · " +
          episodeEntries(e, state.entries).length +
          " " +
          v("linked"),
      ),
      el(
        "div",
        { class: "action-pair" },
        button(v("edit"), () => openEpisode(e.id)),
        button(v("chatFrom"), () =>
          window.startContextChat({ period: "all", episodeIds: [e.id] }),
        ),
      ),
    );
    root.append(card);
  }
}
export function historySetFilter(symptom) {
  state.historyFilter = symptom;
  renderHistory();
}
registerScreen("history", renderHistory);

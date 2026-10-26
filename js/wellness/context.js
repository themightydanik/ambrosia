import { localDay, shiftDay, statistics, validDay } from "./model.js";
export const CONTEXT_LIMIT = 24;
export function prepareContext(data, config = {}, today = localDay()) {
  if (validDay(config.endDate) && config.endDate <= today)
    today = config.endDate;
  const days = ["7", "30", "90", "365", "all"].includes(String(config.period))
    ? String(config.period)
    : "7";
  const start =
    validDay(config.startDate) && config.startDate <= today
      ? config.startDate
      : days === "all"
        ? null
        : shiftDay(today, 1 - Number(days));
  const fields = {
    symptoms: true,
    checkins: true,
    episodes: true,
    notes: false,
    feeling: true,
    mood: true,
    energy: true,
    sleep: true,
    ...config.fields,
  };
  const inRange = (day) => (!start || day >= start) && day <= today;
  let entries = data.entries.filter((e) => !e.isUpdate && inRange(e.date));
  if (config.entryIds?.length)
    entries = entries.filter((e) => config.entryIds.includes(String(e.id)));
  if (config.episodeIds?.length)
    entries = entries.filter((e) => config.episodeIds.includes(e.episodeId));
  if (config.symptoms?.length)
    entries = entries.filter((e) =>
      e.symptoms.some((s) => config.symptoms.includes(s)),
    );
  let checkins = data.checkins.filter((c) => inRange(c.date));
  if (
    config.entryIds?.length ||
    config.episodeIds?.length ||
    config.symptoms?.length
  )
    checkins = [];
  let episodes = data.episodes.filter(
    (e) => (!start || !e.endDate || e.endDate >= start) && e.startDate <= today,
  );
  if (config.episodeIds?.length)
    episodes = episodes.filter((e) => config.episodeIds.includes(e.id));
  if (config.symptoms?.length)
    episodes = episodes.filter((e) =>
      entries.some((x) => x.episodeId === e.id),
    );
  if (config.entryIds?.length)
    episodes = episodes.filter((e) =>
      entries.some((x) => x.episodeId === e.id),
    );
  const candidates = [
    ...(fields.symptoms
      ? entries.map((e) => ({
          kind: "entry",
          id: String(e.id),
          date: e.date,
          payload: {
            id: e.id,
            date: e.date,
            time: e.time,
            symptoms: e.symptoms,
            intensity: e.intensity,
            statusUpdates: (e.statusUpdates || []).map((u) => ({
              date: u.date,
              status: u.status,
              ...(fields.notes ? { notes: u.notes } : {}),
            })),
            episodeId: e.episodeId || null,
            ...(fields.notes ? { notes: e.notes } : {}),
          },
        }))
      : []),
    ...(fields.checkins
      ? checkins.map((c) => ({
          kind: "checkin",
          id: c.id,
          date: c.date,
          payload: {
            id: c.id,
            date: c.date,
            ...Object.fromEntries(
              ["feeling", "mood", "energy", "sleep"]
                .filter((k) => fields[k])
                .map((k) => [k, c[k]]),
            ),
            ...(fields.notes ? { note: c.note } : {}),
          },
        }))
      : []),
    ...(fields.episodes
      ? episodes.map((e) => ({
          kind: "episode",
          id: e.id,
          date: e.startDate,
          payload: { ...e, ...(!fields.notes ? { notes: undefined } : {}) },
        }))
      : []),
  ].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  );
  const selected = [];
  let bytes = 0;
  for (const c of candidates) {
    if (selected.length >= CONTEXT_LIMIT) break;
    const size = JSON.stringify(c).length;
    if (selected.length >= CONTEXT_LIMIT || bytes + size > 9500) continue;
    selected.push(c);
    bytes += size;
  }
  const refs = selected.map((c, i) => ({
    sourceId: "S" + (i + 1),
    id: c.id,
    kind: c.kind,
    date: c.date,
  }));
  const summary = statistics(
    fields.checkins ? checkins : [],
    fields.symptoms ? entries : [],
    {
      end: today,
      days: start
        ? Math.round(
            (new Date(today + "T12:00Z") - new Date(start + "T12:00Z")) /
              86400000,
          ) + 1
        : days === "all"
          ? Math.max(
              7,
              Math.ceil(
                (new Date(today + "T12:00Z") -
                  new Date((candidates.at(-1)?.date || today) + "T12:00Z")) /
                  86400000,
              ) + 1,
            )
          : Number(days),
    },
  );
  const recent = statistics(
    fields.checkins ? checkins : [],
    fields.symptoms ? entries : [],
    { end: today, days: Math.min(7, summary.days) },
  );
  recent.dimensions = Object.fromEntries(
    Object.entries(recent.dimensions).filter(
      ([k]) => fields.checkins && fields[k],
    ),
  );
  summary.recentWeek = recent;
  summary.dimensions = Object.fromEntries(
    Object.entries(summary.dimensions).filter(
      ([k]) => fields.checkins && fields[k],
    ),
  );
  const coverage = {
    from: start,
    to: today,
    available: candidates.length,
    selected: selected.length,
    omitted: candidates.length - selected.length,
    partial: selected.length < candidates.length,
    notes: fields.notes,
    observedDays: summary.observedDays,
  };
  return {
    version: 1,
    config: { ...config, period: days, fields },
    coverage,
    summary,
    records: selected,
    sources: refs,
  };
}
export function contextMarkdown(context) {
  const fenced = (value) => {
    const text = JSON.stringify(value, null, 2),
      runs = text.match(/`+/g) || [],
      fence = "`".repeat(Math.max(3, ...runs.map((r) => r.length + 1)));
    return fence + "json\n" + text + "\n" + fence;
  };
  return (
    `# Ambrosia selected health context\n\nRange: ${context.coverage.from || "all available"} — ${context.coverage.to}\nSelected: ${context.coverage.selected}/${context.coverage.available}; omitted: ${context.coverage.omitted}. Missing days are not healthy days. These are observations, not medical conclusions.\n\n## Deterministic statistics\n\n${fenced(context.summary)}\n\n## Selected records\n\n` +
    context.records
      .map(
        (r, i) =>
          `### [S${i + 1}] ${r.kind} · ${r.date}\n\n${fenced(r.payload)}`,
      )
      .join("\n\n")
  );
}
export function contextCSV(context) {
  const cell = (value) =>
    '"' +
    String(value ?? "")
      .replaceAll('"', '""')
      .replace(/^(\s*[=+@\-])/, "'$1") +
    '"';
  return [
    [
      "kind",
      "id",
      "date",
      "feeling",
      "mood",
      "energy",
      "sleep",
      "symptoms",
      "intensity",
      "notes",
    ],
    ...context.records.map((r) => [
      r.kind,
      r.id,
      r.date,
      r.payload.feeling,
      r.payload.mood,
      r.payload.energy,
      r.payload.sleep,
      r.payload.symptoms?.join("; "),
      r.payload.intensity,
      r.payload.note || r.payload.notes,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}

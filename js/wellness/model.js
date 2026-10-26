export const DIMENSIONS = ["feeling", "mood", "energy", "sleep"];
export function localDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return false;
  const date = new Date(day + "T12:00:00Z");
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
  );
}
export function shiftDay(day, delta) {
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return localDay(d);
}
export async function checkinId(day) {
  if (!validDay(day)) throw Error("INVALID_DATE");
  const b = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode("ambrosia-checkin-v1:" + day),
    ),
  ).slice(0, 16);
  b[6] = (b[6] & 15) | 80;
  b[8] = (b[8] & 63) | 128;
  const s = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
export async function makeCheckin(day, values) {
  if (
    !validDay(day) ||
    DIMENSIONS.some(
      (k) => !Number.isInteger(values[k]) || values[k] < 1 || values[k] > 5,
    ) ||
    String(values.note || "").length > 600
  )
    throw Error("INVALID_CHECKIN");
  return {
    id: await checkinId(day),
    date: day,
    ...Object.fromEntries(DIMENSIONS.map((k) => [k, values[k]])),
    note: String(values.note || ""),
    updatedAt: new Date().toISOString(),
  };
}
export function makeEpisode(values, previous = {}) {
  if (
    !String(values.title || "").trim() ||
    String(values.title).length > 100 ||
    !validDay(values.startDate) ||
    !["ongoing", "recovering", "recovered"].includes(values.status) ||
    (values.endDate &&
      (!validDay(values.endDate) || values.endDate < values.startDate))
  )
    throw Error("INVALID_EPISODE");
  if (values.status === "recovered" && !values.endDate)
    throw Error("INVALID_EPISODE");
  return {
    id: previous.id || crypto.randomUUID(),
    title: String(values.title).trim(),
    startDate: values.startDate,
    endDate: values.endDate || null,
    status: values.status,
    notes: String(values.notes || "").slice(0, 600),
    updatedAt: new Date().toISOString(),
  };
}
const mean = (values) =>
  values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : null;
export function statistics(
  checkins,
  entries,
  { end = localDay(), days = 7, baselineDays = 28 } = {},
) {
  const start = shiftDay(end, -days + 1),
    priorEnd = shiftDay(start, -1),
    priorStart = shiftDay(priorEnd, -baselineDays + 1);
  // One observation per local day; do not fill missing days or count duplicate imports as extra observations.
  const unique = [...new Map(checkins.map((c) => [c.date, c])).values()];
  const selected = unique.filter((c) => c.date >= start && c.date <= end),
    prior = unique.filter((c) => c.date >= priorStart && c.date <= priorEnd);
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((k) => {
      const values = selected
        .filter((c) => Number.isInteger(c[k]) && c[k] >= 1 && c[k] <= 5)
        .map((c) => c[k]);
      const base = prior
        .filter((c) => Number.isInteger(c[k]) && c[k] >= 1 && c[k] <= 5)
        .map((c) => c[k]);
      const average = mean(values),
        baseline = base.length >= 14 ? mean(base) : null;
      return [
        k,
        {
          mean: average,
          count: values.length,
          baseline,
          baselineCount: base.length,
          difference:
            average !== null && baseline !== null
              ? Math.round((average - baseline) * 10) / 10
              : null,
        },
      ];
    }),
  );
  const symptoms = entries.filter(
    (e) => !e.isUpdate && e.date >= start && e.date <= end,
  );
  return {
    start,
    end,
    days,
    observedDays: selected.length,
    missingDays: days - selected.length,
    dimensions,
    symptomEntries: symptoms.length,
    symptomDays: new Set(symptoms.map((e) => e.date)).size,
    meanIntensity: mean(
      symptoms.map((e) => Number(e.intensity)).filter(Number.isFinite),
    ),
    sufficient: selected.length >= 3,
  };
}
export function episodeEntries(episode, entries) {
  return entries.filter((e) => !e.isUpdate && e.episodeId === episode.id);
}

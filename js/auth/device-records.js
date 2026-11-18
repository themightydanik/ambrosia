// Known device/guest keys only; never enumerate another account's partitions.
export const deviceKeys = [
  "ambrosia_entries",
  "ambrosia_profile",
  "ambrosia_lang",
  "ambrosia_sync_v2:guest",
];
export function hasDeviceJournal(storage = localStorage) {
  try {
    const legacy = storage.getItem(deviceKeys[0]);
    if (legacy) {
      try {
        const data = JSON.parse(legacy);
        if (!Array.isArray(data) || data.length) return true;
      } catch {
        return true;
      }
    }
    const raw = storage.getItem(deviceKeys[3]);
    if (!raw) return false;
    try {
      const doc = JSON.parse(raw);
      if (
        !doc?.records ||
        typeof doc.records !== "object" ||
        Array.isArray(doc.records)
      )
        return true;
      return (
        Object.values(doc.records).some((r) => !r || r.kind !== "profile") ||
        !!doc.archives?.length
      );
    } catch {
      return true;
    }
  } catch {
    return true;
  } // Offer recovery on read errors too; never silently suggest empty data.
}

export const intentKey = "ambrosia_google_pkce_v1",
  generationKey = "ambrosia_auth_intent_generation_v1";
let committing = null;
const fallbackGenerations = new WeakMap();
export function authGeneration(storage = localStorage) {
  if (fallbackGenerations.has(storage)) return fallbackGenerations.get(storage);
  return storage.getItem(generationKey) || "0";
}
export function invalidateAuthIntent(storage = localStorage) {
  const next = crypto.randomUUID();
  fallbackGenerations.set(storage, next);
  // Removing the verifier first also frees space on quota-full devices.
  // An intent-storage failure must never prevent the runtime hiding a previous account.
  try {
    storage.removeItem(intentKey);
  } catch {
    /* Current document's generation still changes. */
  }
  try {
    storage.setItem(generationKey, next);
    fallbackGenerations.delete(storage);
  } catch {
    /* Fail closed in this document. */
  }
}
export const committingOAuthFor = (user) => !!user && committing === user;
export async function authTransition(work) {
  if (navigator.locks)
    return navigator.locks.request("ambrosia-auth-transition", work);
  return work(); // Email/recovery remains available without Web Locks. Google requires them.
}
export async function oauthCommit(user, work) {
  committing = user;
  try {
    return await work();
  } finally {
    committing = null;
  }
}

import { securityText } from "../security-copy.js";
import { state } from "../state.js";
import { registerScreen, goTo } from "../navigation.js";
import { accountAccess, refreshAccess } from "../account-access.js";
import { isAndroid } from "../platform.js";
import { el, button } from "../wellness/dom.js";
import { billingCopy, periodLabel } from "../billing/copy.js";
import {
  loadPlans,
  transact,
  verifyBilling,
  manageSubscription,
} from "../billing/client.js";
let plans = [],
  notice = "",
  busy = false,
  loading = false,
  loadedUser,
  epoch = 0,
  uncertain = false;
function message(error, t) {
  if (error.userCancelled || String(error.code) === "1") return t.cancelled;
  if (
    [
      "BILLING_CONFIRMATION_PENDING",
      "SERVICE_UNAVAILABLE",
      "BILLING_VERIFICATION_UNAVAILABLE",
    ].includes(error.message)
  )
    return t.pending;
  if (error.message === "PRICE_CHANGED") return t.changed;
  if (
    error.message === "ACCOUNT_CHANGED" ||
    error.message === "SESSION_EXPIRED"
  )
    return t.account;
  if (
    error.message === "PURCHASE_OWNED_BY_ANOTHER_ACCOUNT" ||
    ["7", "8"].includes(String(error.code))
  )
    return t.ownership;
  return t.error;
}
async function action(work, kind) {
  if (busy) return;
  const token = epoch,
    user = state.accountId;
  busy = true;
  notice = billingCopy(state.lang).working;
  renderUpgrade();
  try {
    const confirmed = await work();
    if (token !== epoch || user !== state.accountId) return;
    notice = confirmed
      ? billingCopy(state.lang).confirmed
      : billingCopy(state.lang).pending;
    uncertain = kind === "purchase" && !confirmed;
  } catch (e) {
    if (token !== epoch || user !== state.accountId) return;
    notice = message(e, billingCopy(state.lang));
    if (
      kind === "purchase" &&
      !e.userCancelled &&
      String(e.code) !== "1" &&
      ![
        "PRICE_CHANGED",
        "PRODUCTS_UNAVAILABLE",
        "ACCOUNT_CHANGED",
        "SIGN_IN_REQUIRED",
        "EMAIL_CONFIRMATION_REQUIRED",
        "BILLING_NOT_CONFIGURED",
      ].includes(e.message)
    )
      uncertain = true;
  } finally {
    if (token === epoch) {
      busy = false;
      renderUpgrade();
    }
  }
}
async function reload() {
  const token = ++epoch,
    user = state.accountId;
  loading = true;
  plans = [];
  notice = "";
  renderUpgrade();
  try {
    const result = await loadPlans();
    if (token === epoch && user === state.accountId) plans = result;
  } catch {
    if (token === epoch) notice = billingCopy(state.lang).unavailable;
  } finally {
    if (token === epoch) {
      loading = false;
      renderUpgrade();
    }
  }
}
window.addEventListener("journal-changed", (e) => {
  if (e.detail?.accountChanged) {
    epoch++;
    plans = [];
    notice = "";
    busy = false;
    loading = false;
    uncertain = false;
    loadedUser = undefined;
  }
});
export function renderUpgrade() {
  const root = document.getElementById("upgrade-content");
  if (!root) return;
  const t = billingCopy(state.lang),
    access = accountAccess(),
    native = isAndroid();
  root.replaceChildren();
  root.append(
    el(
      "section",
      { class: "premium-hero" },
      el("span", { class: "eyebrow" }, "AMBROSIA PREMIUM"),
      el("h1", {}, t.title),
      el("p", {}, t.intro),
    ),
  );
  const status = access
    ? {
        active: t.active,
        trial: t.trialStatus,
        cancelled: t.cancelledStatus,
        expired: t.expired,
        free: t.freeStatus,
      }[access.state]
    : t.unknown;
  const box = el(
    "section",
    { class: "wellness-card premium-status" },
    el("h2", {}, t.status),
    el("strong", {}, status),
  );
  if (access?.validUntil)
    box.append(
      el(
        "p",
        {},
        t.until + ": " + new Date(access.validUntil).toLocaleString(state.lang),
      ),
    );
  if (access) {
    box.append(
      el(
        "p",
        {},
        `${t.usage}: ${t.reports} ${access.used}/${access.limit}; ${t.chat} ${access.chat?.used ?? 0}/${access.chat?.limit ?? 0}`,
      ),
      el(
        "p",
        {},
        `${t.renewal}: ${new Date(access.renewsAt).toLocaleDateString(state.lang)}`,
      ),
    );
  }
  root.append(box);
  if (access && !access.aiEnabled)
    root.append(
      el("p", { class: "billing-notice" }, securityText(state.lang).disabled),
    );
  for (const [title, items] of [
    [t.free, t.freeItems],
    [t.premium, t.premiumItems],
  ])
    root.append(
      el(
        "section",
        { class: "wellness-card" },
        el("h2", {}, title),
        el(
          "ul",
          { class: "premium-benefits" },
          items.map((text) => el("li", {}, text)),
        ),
      ),
    );
  if (access?.allowances)
    root.append(
      el(
        "p",
        { class: "context-caption" },
        `${t.reports}: Free ${access.allowances.free} / Premium ${access.allowances.premium}. ${t.chat}: Free ${access.chat?.allowances?.free ?? "—"} / Premium ${access.chat?.allowances?.premium ?? "—"}.`,
      ),
    );
  if (!state.accountId)
    root.append(
      el("p", {}, t.signin),
      button(t.signInAction, () => goTo("settings")),
    );
  else if (!native) root.append(el("p", { class: "wellness-card" }, t.web));
  else if (loading) root.append(el("p", { role: "status" }, t.loading));
  else if (access?.tier !== "premium") {
    for (const plan of plans) {
      const card = el(
        "section",
        { class: "wellness-card purchase-plan" },
        el("h2", {}, plan.type === "MONTHLY" ? t.monthly : t.yearly),
      );
      for (const [i, phase] of plan.phases.entries())
        card.append(
          el(
            "p",
            { class: i === 0 ? "plan-price" : "" },
            `${i ? t.then + " " : ""}${phase.price.formatted} ${t.per} ${periodLabel(phase.billingPeriod.iso8601, state.lang)} · ${phase.recurrenceMode === 1 ? t.renews : (phase.recurrenceMode === 3 ? 1 : phase.billingCycleCount) + " " + t.cycles}`,
          ),
        );
      card.append(
        el(
          "p",
          { class: "context-caption" },
          plan.option.isBasePlan ? t.notrial : t.trial,
        ),
        button(t.purchase, () => action(() => transact(plan), "purchase"), {
          class: "btn-primary",
          disabled: busy || uncertain,
        }),
      );
      root.append(card);
    }
    root.append(button(t.reload, reload, { disabled: busy }));
  }
  if (state.accountId)
    root.append(
      button(
        t.check,
        () =>
          action(async () => {
            if (native) await verifyBilling();
            else await refreshAccess(true);
            return accountAccess()?.tier === "premium";
          }, "check"),
        { disabled: busy || loading },
      ),
    );
  if (native && state.accountId)
    root.append(
      button(t.restore, () => action(() => transact(), "restore"), {
        disabled: busy || loading,
      }),
    );
  root.append(
    button(
      t.manage,
      () =>
        manageSubscription().catch(() => {
          notice = t.error;
          renderUpgrade();
        }),
      { disabled: busy },
    ),
  );
  root.append(
    el(
      "p",
      { role: "status", "aria-live": "polite", class: "billing-notice" },
      notice,
    ),
    el("p", { class: "context-caption" }, t.terms),
    el("p", { class: "context-caption" }, t.billingIssue),
    el("p", { class: "context-caption" }, t.privacy),
    el("p", { class: "context-caption" }, t.noRenew),
  );
  if (
    native &&
    state.accountId &&
    loadedUser !== state.accountId &&
    !loading &&
    !busy
  ) {
    loadedUser = state.accountId;
    queueMicrotask(reload);
  }
}
export function handleUpgrade() {
  renderUpgrade();
}
registerScreen("upgrade", renderUpgrade);

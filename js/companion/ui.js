import {downloadBlob} from '../download.js';
import { exportUserData } from "../account-management.js";
import { t } from "../i18n.js";
import { copy as syncCopy } from "../sync/copy.js";
import { state } from "../state.js";
import { goTo, registerScreen } from "../navigation.js";
import { getSupabaseClient } from "../supabase-client.js";
import {
  authenticatedFetch,
  refreshAccess,
  accountAccess,
} from "../account-access.js";
import { syncedSources, syncStatus, recordVersion } from "../sync/runtime.js";
import { ChatStore } from "./store.js";
import {
  prepareContext,
  contextMarkdown,
  contextCSV,
} from "../wellness/context.js";
import { el, button, field } from "../wellness/dom.js";
import { v } from "../wellness/copy.js";
import { securityText } from "../security-copy.js";
import { openCheckin } from "../screens/checkin.js";
import { openEpisode } from "../screens/episode.js";
import { renderReportTools, reportState } from "../screens/ai.js";
let chatEpoch = 0;
let viewGeneration = 0,
  interactionVersion = 0;
let store,
  busy = false,
  loading = false,
  exportConfig = { period: "30" };
const data = () => ({
  entries: state.entries,
  checkins: state.checkins,
  episodes: state.episodes,
});
function currentStore() {
  if (!store || store.user !== state.accountId)
    store = new ChatStore(localStorage, state.accountId, {
      writable: syncStatus().writable,
    });
  return store;
}
export function startContextChat(config = { period: "7" }) {
  const s = currentStore();
  if (!s.writable) {
    alert(v("chatOffline"));
    return;
  }
  s.create(v("untitled"), config);
  goTo("ai");
}
window.startContextChat = startContextChat;
function safe(action) {
  return async () => {
    try {
      await action();
    } catch {
      const p = document.getElementById("chat-status");
      if (p) p.textContent = v("chatError");
    }
  };
}
async function saveRemote(s, c) {
  if (!s.user || !navigator.onLine) throw Error("OFFLINE");
  const client = await getSupabaseClient();
  const { data: row, error } = await client.rpc("chat_save_conversation", {
    p_id: c.id,
    p_user: s.user,
    p_title: c.title,
    p_config: c.config,
    p_linked: c.config.entryIds?.[0]
      ? { kind: "entry", id: c.config.entryIds[0] }
      : c.config.episodeIds?.[0]
        ? { kind: "episode", id: c.config.episodeIds[0] }
        : null,
  });
  if (error) throw error;
  if (state.accountId !== s.user) return;
  if (row.deleted) {
    s.remove(c.id);
    throw Error("CHAT_DELETED");
  }
  s.edit(c.id, { dirty: false, remote: true });
}
async function refreshRemote() {
  const s = currentStore(),
    user = s.user;
  if (!user || !navigator.onLine || loading) return;
  loading = true;
  try {
    const client = await getSupabaseClient();
    let cursor;
    for (;;) {
      let q = client
        .from("chat_conversations")
        .select("*")
        .eq("user_id", user)
        .order("id", { ascending: true })
        .limit(100);
      if (cursor) q = q.gt("id", cursor);
      const { data: rows, error } = await q;
      if (error) throw error;
      if (state.accountId !== user) return;
      for (const row of rows) s.mergeConversation(row);
      if (rows.length < 100) break;
      cursor = rows.at(-1).id;
    }
    for (const c of Object.values(s.doc.conversations))
      if (c.dirty) {
        await saveRemote(s, c);
        if (state.accountId !== user) return;
      }
    const c = s.get();
    if (c?.remote) await loadMessages(s, c.id);
  } catch {
    /* Cached history and drafts remain usable. */
  } finally {
    loading = false;
  }
}
async function loadMessages(s, id, before) {
  const client = await getSupabaseClient();
  let q = client
    .from("chat_messages")
    .select("*")
    .eq("user_id", s.user)
    .eq("conversation_id", id)
    .order("sequence", { ascending: false })
    .limit(50);
  if (before) q = q.lt("sequence", before);
  const { data: rows, error } = await q;
  if (error) throw error;
  if (state.accountId !== s.user) return;
  s.mergeMessages(id, rows);
  return rows;
}
export function openSource(source) {
  const exists =
    source.kind === "checkin"
      ? state.checkins.some((c) => c.id === source.id)
      : source.kind === "episode"
        ? state.episodes.some((c) => c.id === source.id)
        : state.entries.some((c) => String(c.id) === source.id);
  if (!exists) {
    alert(v("sourceMissing"));
    return;
  }
  if (source.version && recordVersion(source.id) !== source.version)
    alert(v("sourceChanged"));
  if (source.kind === "checkin") {
    const c = state.checkins.find((c) => c.id === source.id);
    if (c) openCheckin(c.date);
  } else if (source.kind === "episode") openEpisode(source.id);
  else {
    const entry = state.entries.find((e) => String(e.id) === source.id);
    if (entry) window.openEntryModal(entry.id);
  }
}
async function download(context, type) {
  if (!confirm(v("exportWarning"))) return;
  const body =
    type === "md"
      ? contextMarkdown(context)
      : type === "csv"
        ? contextCSV(context)
        : JSON.stringify(context, null, 2);
  try { await downloadBlob(new Blob([body],{type:type==='json'?'application/json':type==='csv'?'text/csv':'text/markdown'}),'ambrosia-context.'+type); }
  catch { alert(v('error')); }
}
function contextPanel(s, c) {
  const context = prepareContext(data(), c.config),
    panel = el("details", { class: "context-panel", id: "chat-context" }),
    summary = el(
      "summary",
      {},
      v("context") +
        " · " +
        context.coverage.selected +
        "/" +
        context.coverage.available,
    );
  panel.append(summary);
  const config = {
      ...c.config,
      fields: {
        symptoms: true,
        checkins: true,
        episodes: true,
        notes: false,
        feeling: true,
        mood: true,
        energy: true,
        sleep: true,
        ...c.config.fields,
      },
    },
    select = el("select", { id: "chat-period" });
  for (const period of ["7", "30", "90", "365", "all"])
    select.append(
      el(
        "option",
        { value: period, selected: (config.period || "7") === period },
        period === "all" ? v("all") : period + " " + v("days"),
      ),
    );
  const update = () => {
    if (c.id) s.edit(c.id, { config, dirty: true });
    else exportConfig = config;
    renderCompanion();
  };
  select.onchange = () => {
    config.period = select.value;
    delete config.startDate;
    delete config.endDate;
    update();
  };
  panel.append(field(v("period"), select));
  for (const [key, label] of [
    ["symptoms", "symptoms"],
    ["checkins", "checkin"],
    ["episodes", "episodes"],
    ["notes", "notes"],
    ["feeling", "feeling"],
    ["mood", "mood"],
    ["energy", "energy"],
    ["sleep", "sleep"],
  ]) {
    const box = el("input", {
      type: "checkbox",
      checked: config.fields[key],
      "data-context-field": key,
    });
    box.onchange = () => {
      config.fields[key] = box.checked;
      update();
    };
    panel.append(el("label", { class: "checkbox-line" }, box, v(label)));
  }
  for (const key of ["startDate", "endDate"]) {
    const date = el("input", { type: "date", value: config[key] || "" });
    date.onchange = () => {
      config[key] = date.value;
      update();
    };
    panel.append(field(v(key === "startDate" ? "start" : "end"), date));
  }
  const syms = el(
    "select",
    { id: "chat-symptom" },
    el("option", { value: "" }, v("all")),
  );
  for (const symptom of [...new Set(state.entries.flatMap((e) => e.symptoms))])
    syms.append(
      el(
        "option",
        { value: symptom, selected: config.symptoms?.includes(symptom) },
        t(symptom),
      ),
    );
  syms.onchange = () => {
    config.symptoms = syms.value ? [syms.value] : [];
    update();
  };
  panel.append(field(v("symptoms"), syms));
  const entries = el("select", {
    multiple: "",
    size: 4,
    id: "chat-selected-entries",
    "aria-label": v("chooseRecords"),
  });
  for (const e of state.entries
    .filter((e) => !e.isUpdate)
    .slice(-100)
    .reverse())
    entries.append(
      el(
        "option",
        {
          value: String(e.id),
          selected: config.entryIds?.includes(String(e.id)),
        },
        e.date + " · " + e.symptoms.map(t).join(", "),
      ),
    );
  entries.onchange = () => {
    config.entryIds = [...entries.selectedOptions].map((o) => o.value);
    update();
  };
  panel.append(field(v("chooseRecords"), entries));
  panel.append(
    el(
      "p",
      { class: "muted" },
      v("coverage") +
        ": " +
        (context.coverage.from || v("all")) +
        " — " +
        context.coverage.to +
        " · " +
        context.coverage.omitted +
        " " +
        v("omitted"),
    ),
    el(
      "p",
      { class: "muted" },
      context.coverage.partial ? v("partial") : v("contextCloud"),
    ),
  );
  const list = el("div", { class: "source-list" });
  for (const source of context.sources)
    list.append(
      button(
        source.sourceId +
          " · " +
          v(
            source.kind === "entry"
              ? "symptoms"
              : source.kind === "checkin"
                ? "checkin"
                : "episode",
          ) +
          " · " +
          source.date,
        () => openSource(source),
      ),
    );
  if (!context.sources.length)
    list.append(el("p", { class: "muted" }, v("noSources")));
  panel.append(list);
  panel.append(
    el(
      "details",
      { class: "context-json" },
      el("summary", {}, v("inspect")),
      el(
        "pre",
        {},
        JSON.stringify(
          {
            coverage: context.coverage,
            summary: context.summary,
            records: context.records,
          },
          null,
          2,
        ),
      ),
    ),
  );
  panel.append(
    el("p", { class: "muted" }, v("export")),
    el(
      "div",
      { class: "export-buttons" },
      ...["md", "json", "csv"].map((type) =>
        button(type.toUpperCase(), () => download(context, type)),
      ),
    ),
  );
  return panel;
}
export function renderCompanion() {
  viewGeneration++;
  const s = currentStore(),
    root = document.getElementById("companion-content");
  if (!root) return;
  const contextWasOpen = root.querySelector("#chat-context")?.open;
  root.replaceChildren();
  const c = s.get();
  root.append(
    el(
      "header",
      { class: "page-head" },
      el("p", { class: "eyebrow" }, v("chatTitle")),
      el("h1", {}, c ? c.title : v("chatIntro")),
    ),
  );
  const access = accountAccess();
  root.append(
    el(
      "p",
      { class: "chat-quota", id: "chat-quota" },
      access?.chat
        ? v("chatUsage") +
            ": " +
            access.chat.used +
            "/" +
            access.chat.limit +
            " · " +
            securityText(state.lang).renew +
            ": " +
            new Date(access.chat.renewsAt).toISOString()
        : securityText(state.lang).unknown,
    ),
  );
  root.append(el("p", { class: "chat-storage-note muted" }, v("chatStorage")));
  const status = el("p", {
    id: "chat-status",
    role: "status",
    class: "form-message",
  });
  root.append(status);
  root.append(
    button(
      "↻",
      safe(async () => {
        await refreshRemote();
        renderCompanion();
      }),
      { "aria-label": v("refresh"), class: "chat-refresh" },
    ),
  );
  if (!c) {
    root.append(
      button("+ " + v("newChat"), () => startContextChat({ period: "7" }), {
        class: "btn-primary chat-new",
        id: "new-chat",
      }),
    );
    const list = el(
      "section",
      { class: "conversation-list" },
      el("h2", {}, v("conversations")),
    );
    for (const item of Object.values(s.doc.conversations).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ))
      list.append(
        button(
          item.title,
          safe(async () => {
            s.select(item.id);
            if (item.remote) await loadMessages(s, item.id);
            renderCompanion();
          }),
          { class: "conversation-item", "data-conversation": item.id },
        ),
      );
    if (!Object.keys(s.doc.conversations).length)
      list.append(el("p", { class: "empty-message" }, v("chatIntro")));
    root.append(list);
    root.append(contextPanel(s, { id: null, config: exportConfig })); // independent free context export
    // Export-only context changes use a real local draft conversation, preserving the selected fields.
    renderReportTools(root);
  } else {
    const actions = el(
      "div",
      { class: "chat-actions" },
      button("← " + v("conversations"), () => {
        s.select(null);
        renderCompanion();
      }),
      button(
        v("rename"),
        safe(async () => {
          const title = prompt(v("rename"), c.title);
          if (!title?.trim()) return;
          s.edit(c.id, { title: title.trim().slice(0, 100), dirty: true });
          if (s.user && navigator.onLine) await saveRemote(s, s.get(c.id));
          renderCompanion();
        }),
      ),
      button(
        v("remove"),
        safe(async () => {
          if (!confirm(v("deleteChat"))) return;
          if (c.remote) {
            if (!navigator.onLine) throw Error("OFFLINE");
            const client = await getSupabaseClient();
            const { error } = await client.rpc("chat_delete_conversation", {
              p_id: c.id,
              p_user: s.user,
            });
            if (error) throw error;
          }
          s.remove(c.id);
          renderCompanion();
        }),
      ),
    );
    root.append(actions, contextPanel(s, c));
    const messages = el("section", {
      class: "chat-messages",
      id: "chat-messages",
      "aria-label": v("conversations"),
    });
    const first = Math.min(
      ...c.messages.filter((m) => m.sequence).map((m) => m.sequence),
    );
    if (Number.isFinite(first) && first > 1)
      messages.append(
        button(
          v("loadMore"),
          safe(async () => {
            await loadMessages(s, c.id, first);
            renderCompanion();
          }),
        ),
      );
    for (const m of c.messages) {
      const bubble = el(
        "article",
        { class: "chat-message " + m.role, "data-message-state": m.state },
        el("p", {}, m.content),
        el("small", {}, v(m.state === "sending" && !busy ? "failed" : m.state)),
      );
      if (m.role === "assistant")
        for (const source of m.sources || [])
          bubble.append(
            button(
              "↗ " + source.sourceId + " · " + source.date,
              () => openSource(source),
              { class: "source-button" },
            ),
          );
      if (
        m.role === "user" &&
        (m.state === "failed" || (m.state === "sending" && !busy))
      )
        bubble.append(button(v("retry"), () => send(c.id, m.content)));
      messages.append(bubble);
    }
    root.append(messages);
    const suggestions = el("div", { class: "chat-suggestions" });
    for (const key of ["follow1", "follow2", "follow3"])
      suggestions.append(
        button(v(key), () => {
          s.edit(c.id, { draft: v(key) });
          renderCompanion();
          document.getElementById("chat-question")?.focus();
        }),
      );
    root.append(suggestions);
    const text = el(
      "textarea",
      {
        id: "chat-question",
        rows: 2,
        maxlength: 2000,
        placeholder: v("composer"),
        "aria-label": v("composer"),
      },
      c.draft || "",
    );
    text.oninput = () => {
      try {
        s.edit(c.id, { draft: text.value });
        status.textContent = v("draft");
      } catch {
        status.textContent = v("error");
      }
    };
    const form = el(
      "form",
      { class: "chat-composer" },
      button(
        v("context") +
          " · " +
          prepareContext(data(), c.config).coverage.selected,
        () => {
          const panel = document.getElementById("chat-context");
          panel.open = true;
          panel.scrollIntoView({ block: "start" });
        },
        { class: "composer-context" },
      ),
      text,
      el(
        "button",
        {
          type: "submit",
          class: "btn-primary",
          disabled: busy,
          id: "chat-send",
        },
        busy ? v("sending") : v("send"),
      ),
    );
    form.onsubmit = (e) => {
      e.preventDefault();
      void send(c.id, text.value);
    };
    root.append(
      form,
      el("p", { class: "page-footnote" }, v("contextCloud")),
      el(
        "p",
        { class: "page-footnote" },
        securityText(state.lang).aiDisclaimer,
      ),
    );
    renderReportTools(root);
  }
  if (contextWasOpen && root.querySelector("#chat-context"))
    root.querySelector("#chat-context").open = true;
  if (!s.writable) {
    status.textContent = (syncCopy[state.lang] || syncCopy.en).locked;
    root
      .querySelectorAll("button,input,textarea,select")
      .forEach((node) => (node.disabled = true));
  }
  void refreshAccess().then(() => {
    const a = accountAccess(),
      q = document.getElementById("chat-quota");
    if (a?.chat && q)
      q.textContent =
        v("chatUsage") +
        ": " +
        a.chat.used +
        "/" +
        a.chat.limit +
        " · " +
        v("reportUsage") +
        ": " +
        a.used +
        "/" +
        a.limit;
  });
}
async function send(id, question) {
  const token = chatEpoch;
  const s = currentStore(),
    c = s.get(id);
  if (busy || !question.trim()) return;
  const status = document.getElementById("chat-status");
  if (!s.user || !navigator.onLine) {
    s.edit(id, { draft: question });
    status.textContent = v("chatOffline");
    return;
  }
  const context = prepareContext(data(), c.config);
  if (!confirm(v("chatConsent"))) return;
  const requestId = crypto.randomUUID();
  try {
    s.addQuestion(id, question, requestId);
  } catch {
    status.textContent = v("error");
    return;
  }
  busy = true;
  renderCompanion();
  let failureMessage;
  try {
    await saveRemote(s, c);
    if (state.accountId !== s.user || token !== chatEpoch) return;
    const result = await authenticatedFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: id,
        requestId,
        question,
        sources: syncedSources(context.sources).map(
          ({ id, kind, version }) => ({ id, kind, version }),
        ),
        coverage: context.coverage,
        summary: context.summary,
        includeNotes: context.config.fields.notes,
        fields: Object.fromEntries(
          ["feeling", "mood", "energy", "sleep"].map((k) => [
            k,
            context.config.fields[k],
          ]),
        ),
        language: state.lang,
        consent: "groq-chat-v1",
      }),
    });
    if (state.accountId !== s.user || token !== chatEpoch) return;
    if (result.message) s.mergeMessages(id, [result.message]);
    await loadMessages(s, id);
  } catch (error) {
    try {
      s.fail(id, requestId);
    } catch {
      /* A deleted/replaced account cache must never be recreated by a late callback. */
    }
    if (state.accountId === s.user && token === chatEpoch) {
      failureMessage =
        error.message === "CONTEXT_CHANGED"
          ? v("contextChanged")
          : securityText(state.lang)[error.message] || v("chatError");
    }
  } finally {
    if (token === chatEpoch) busy = false;
    if (state.accountId === s.user && token === chatEpoch) {
      await refreshAccess(true);
      renderCompanion();
      if (failureMessage)
        document.getElementById("chat-status").textContent = failureMessage;
    }
  }
}
export async function initializeCompanion() {
  const view = viewGeneration,
    interaction = interactionVersion,
    reports = reportState().version;
  await refreshRemote();
  if (
    state.screen === "ai" &&
    view === viewGeneration &&
    interaction === interactionVersion &&
    reports === reportState().version &&
    !busy &&
    !document.activeElement?.closest(".chat-composer")
  )
    renderCompanion();
}
function showChatStorageError() {
  const root = document.getElementById("companion-content");
  root.replaceChildren(
    el(
      "header",
      { class: "page-head" },
      el("h1", {}, v("chatTitle")),
      el("p", { id: "chat-status", role: "status" }, v("cacheError")),
      button(securityText(state.lang).export, safe(exportUserData)),
    ),
  );
}
registerScreen("ai", () => {
  try {
    renderCompanion();
    void initializeCompanion().catch(showChatStorageError);
  } catch {
    showChatStorageError();
  }
});
window.addEventListener("journal-changed", (event) => {
  if (event.detail.accountChanged) {
    chatEpoch++;
    store = null;
    busy = false;
  }
});
window.addEventListener("online", () => {
  if (state.screen === "ai") void initializeCompanion();
});

document.addEventListener("pointerdown", (event) => {
  if (event.target.closest("#companion-content")) interactionVersion++;
});
window.visualViewport?.addEventListener("resize", () => {
  if (document.activeElement?.closest(".chat-composer"))
    document.activeElement.scrollIntoView({ block: "nearest" });
});

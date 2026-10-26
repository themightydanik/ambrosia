// External-service fixture; protected Netlify handlers and browser code run unchanged.
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const env = {
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "fixture-public",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-private",
  GROQ_API_KEY: "fixture-groq",
};
module.exports = function backend(rows) {
  const tiers = new Map(),
    used = new Map(),
    chatUsed = new Map(),
    deleted = new Set(),
    conversations = new Map(),
    messages = new Map();
  let providerCalls = 0,
    failNextChat = false;
  const transcripts = [];
  let chatAnswer =
    '<img src=x onerror="window.__xss=1"> Recorded observations [S1] [S999]';
  const snapshot = (user) => ({
    userId: user,
    tier: tiers.get(user) || "free",
    state: tiers.get(user) === "premium" ? "active" : "free",
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    used: used.get(user) || 0,
    limit: tiers.get(user) === "premium" ? 60 : 3,
    remaining: (tiers.get(user) === "premium" ? 60 : 3) - (used.get(user) || 0),
    renewsAt: "2027-01-01T00:00:00Z",
    aiEnabled: true,
    allowances: { free: 3, premium: 60 },
    chat: {
      used: chatUsed.get(user) || 0,
      limit: tiers.get(user) === "premium" ? 120 : 10,
      remaining:
        (tiers.get(user) === "premium" ? 120 : 10) - (chatUsed.get(user) || 0),
      renewsAt: "2027-01-01T00:00:00Z",
    },
  });
  const query = (table, user, params) => {
    let result = [
      ...(table === "chat_conversations" ? conversations : messages).values(),
    ].filter((r) => r.user_id === user);
    if (params.get("conversation_id"))
      result = result.filter(
        (r) => r.conversation_id === params.get("conversation_id"),
      );
    if (params.get("after"))
      result = result.filter((r) => r.id > params.get("after"));
    if (params.get("before"))
      result = result.filter((r) => r.sequence < Number(params.get("before")));
    const order = params.get("order") || "id",
      ascending = params.get("ascending") !== "false";
    result.sort((a, b) =>
      typeof a[order] === "number"
        ? (a[order] - b[order]) * (ascending ? 1 : -1)
        : String(a[order]).localeCompare(String(b[order])) *
          (ascending ? 1 : -1),
    );
    return result.slice(0, Number(params.get("limit") || 500));
  };
  const clientRpc = (user, name, p) => {
    if (p.p_user !== user) throw Error("EXPECTED_ACCOUNT_REQUIRED");
    if (name === "chat_save_conversation") {
      const key = user + p.p_id,
        old = conversations.get(key);
      if (old?.deleted) return old;
      const c = {
        ...old,
        id: p.p_id,
        user_id: user,
        title: p.p_title,
        context_config: p.p_config,
        linked_record: p.p_linked,
        deleted: false,
        created_at: old?.created_at || new Date().toISOString(),
        next_sequence: old?.next_sequence || 1,
      };
      conversations.set(key, c);
      return c;
    }
    if (name === "chat_delete_conversation") {
      const c = conversations.get(user + p.p_id);
      if (c) {
        c.deleted = true;
        c.title = "Deleted";
        c.context_config = {};
        for (const [key, m] of messages)
          if (m.user_id === user && m.conversation_id === p.p_id)
            messages.delete(key);
      }
      return null;
    }
    throw Error("Unexpected client RPC");
  };
  const fetcher = async (url, options) => {
    const token = options.headers.Authorization || "",
      user = token.replace("Bearer test-token-", "");
    if (url.endsWith("/auth/v1/user"))
      return Response.json(
        {
          id: user,
          email: user === A ? "a@example.test" : "b@example.test",
          email_confirmed_at: "2026-01-01",
        },
        { status: deleted.has(user) ? 401 : 200 },
      );
    if (url.includes("/rest/v1/") && !url.includes("/rpc/")) {
      const u = new URL(url),
        table = u.pathname.split("/").at(-1),
        owner = u.searchParams.get("user_id").slice(3);
      let result =
        table === "sync_records"
          ? [...rows.values()].filter((r) => r.user_id === owner)
          : [
              ...(table === "chat_conversations"
                ? conversations
                : messages
              ).values(),
            ].filter((r) => r.user_id === owner);
      if (owner !== user) return Response.json([]);
      const id = u.searchParams.get("id");
      if (id?.startsWith("eq."))
        result = result.filter((r) => r.id === id.slice(3));
      if (id?.startsWith("in.(")) {
        const ids = id.slice(4, -1).split(",");
        result = result.filter((r) => ids.includes(r.id));
      }
      if (u.searchParams.get("deleted") === "eq.false")
        result = result.filter((r) => !r.deleted);
      if (u.searchParams.get("conversation_id"))
        result = result.filter(
          (r) =>
            r.conversation_id ===
            u.searchParams.get("conversation_id").slice(3),
        );
      if (u.searchParams.get("state"))
        result = result.filter(
          (r) => r.state === u.searchParams.get("state").slice(3),
        );
      if (u.searchParams.get("order") === "sequence.desc")
        result.sort((a, b) => b.sequence - a.sequence);
      return Response.json(
        result.slice(0, Number(u.searchParams.get("limit") || 500)),
      );
    }
    if (url.endsWith("/rpc/account_status"))
      return Response.json(snapshot(user));
    if (url.endsWith("/rpc/reserve_ai_request")) {
      const p = JSON.parse(options.body),
        s = snapshot(p.p_user);
      if (s.remaining <= 0)
        return Response.json({
          allowed: false,
          code: "QUOTA_EXCEEDED",
          usage: s,
        });
      used.set(p.p_user, s.used + 1);
      return Response.json({ allowed: true, usage: snapshot(p.p_user) });
    }
    if (url.endsWith("/rpc/finish_ai_request")) return Response.json(null);
    if (url.endsWith("/rpc/chat_begin")) {
      const p = JSON.parse(options.body),
        c = conversations.get(p.p_user + p.p_conversation);
      if (!c || c.deleted)
        return Response.json({ allowed: false, code: "CHAT_DELETED" });
      const key = p.p_user + p.p_request,
        old = messages.get(key + "user");
      if (old)
        return Response.json({
          allowed: false,
          code: "DUPLICATE_REQUEST",
          message: old,
          answer: messages.get(key + "assistant") || null,
        });
      const s = snapshot(p.p_user).chat;
      if (s.remaining <= 0)
        return Response.json({
          allowed: false,
          code: "QUOTA_EXCEEDED",
          usage: s,
        });
      chatUsed.set(p.p_user, s.used + 1);
      const m = {
        user_id: p.p_user,
        conversation_id: p.p_conversation,
        request_id: p.p_request,
        role: "user",
        sequence: c.next_sequence,
        content: p.p_question,
        state: "sending",
        context_meta: p.p_context,
        created_at: new Date().toISOString(),
      };
      c.next_sequence += 2;
      messages.set(key + "user", m);
      return Response.json({
        allowed: true,
        message: m,
        usage: snapshot(p.p_user).chat,
      });
    }
    if (url.endsWith("/rpc/chat_finish")) {
      const p = JSON.parse(options.body),
        c = conversations.get(p.p_user + p.p_conversation),
        key = p.p_user + p.p_request,
        m = messages.get(key + "user");
      if (!c || c.deleted || !m) return Response.json(null);
      m.state = p.p_success ? "completed" : "failed";
      if (!p.p_success) return Response.json(null);
      const a = {
        user_id: p.p_user,
        conversation_id: p.p_conversation,
        request_id: p.p_request,
        role: "assistant",
        sequence: m.sequence + 1,
        content: p.p_text,
        state: "completed",
        sources: p.p_sources,
        created_at: new Date().toISOString(),
      };
      messages.set(key + "assistant", a);
      return Response.json(a);
    }
    if (url.includes("api.groq.com")) {
      providerCalls++;
      const input = JSON.parse(options.body);
      if (input.response_format) {
        transcripts.push(input);
        if (failNextChat) {
          failNextChat = false;
          return Response.json({}, { status: 500 });
        }
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  text: chatAnswer,
                  sourceIds: ["S1", "S999"],
                }),
              },
            },
          ],
        });
      }
      return Response.json({
        choices: [
          {
            message: {
              content: '<img src=x onerror="window.__xss=1"> Observations only',
            },
          },
        ],
      });
    }
    if (url.includes("/auth/v1/token")) {
      const p = JSON.parse(options.body);
      return Response.json(
        {
          user: {
            id:
              p.email === "a@example.test"
                ? A
                : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        },
        { status: p.password === "correct-current-password" ? 200 : 400 },
      );
    }
    if (url.includes("/auth/v1/admin/users/")) {
      const id = url.split("/").at(-1);
      deleted.add(id);
      for (const map of [rows, conversations, messages])
        for (const [key, row] of map) if (row.user_id === id) map.delete(key);
      chatUsed.delete(id);
      return Response.json({});
    }
    throw Error("Unexpected fixture request");
  };
  const ai = require("../netlify/functions/ai.js").createHandler({
      env,
      fetcher,
    }),
    chat = require("../netlify/functions/chat.js").createHandler({
      env,
      fetcher,
    }),
    status = require("../netlify/functions/account-status.js").createHandler({
      env,
      fetcher,
    }),
    remove = require("../netlify/functions/delete-account.js").createHandler({
      env,
      fetcher,
    });
  return {
    invokeChat: (event) => chat(event),
    tiers,
    used,
    chatUsed,
    conversations,
    messages,
    transcripts,
    query,
    clientRpc,
    failChat() {
      failNextChat = true;
    },
    setChatAnswer(text) {
      chatAnswer = text;
    },
    exportChat(user) {
      return {
        conversations: [...conversations.values()].filter(
          (c) => c.user_id === user,
        ),
        messages: [...messages.values()].filter((c) => c.user_id === user),
      };
    },
    get providerCalls() {
      return providerCalls;
    },
    async route(route) {
      const req = route.request(),
        url = new URL(req.url()),
        handler = url.pathname.endsWith("account-status")
          ? status
          : url.pathname.endsWith("delete-account")
            ? remove
            : url.pathname.endsWith("chat")
              ? chat
              : ai;
      const result = await handler({
        httpMethod: req.method(),
        headers: { ...req.headers(), host: url.host },
        body: req.postData(),
      });
      return route.fulfill({
        status: result.statusCode,
        headers: result.headers,
        body: result.body,
      });
    },
  };
};

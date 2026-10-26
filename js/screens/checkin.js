import { state } from "../state.js";
import { goTo, registerScreen } from "../navigation.js";
import { makeCheckin, localDay, DIMENSIONS } from "../wellness/model.js";
import { saveWellness, recordVersion } from "../sync/runtime.js";
import { el, button, field } from "../wellness/dom.js";
import { v, locale } from "../wellness/copy.js";
export function openCheckin(day = localDay()) {
  state.checkinDay = day;
  goTo("checkin");
}
export function renderCheckin() {
  const root = document.getElementById("screen-checkin");
  root.replaceChildren();
  const account = state.accountId,
    day = state.checkinDay || localDay(),
    old = state.checkins.find((c) => c.date === day);
  let version = old ? recordVersion(old.id) : 0;
  const values = old ? { ...old } : {};
  root.append(
    el(
      "header",
      { class: "page-head" },
      button("← " + v("back"), () => goTo("home")),
      el("p", { class: "eyebrow" }, v("checkin")),
      el("h1", {}, v("checkin")),
    ),
  );
  const form = el("form", { class: "wellness-form" }),
    date = el("input", {
      type: "date",
      value: day,
      max: localDay(),
      required: "",
      id: "checkin-date",
    });
  form.append(field(v("date"), date));
  date.onchange = () => {
    state.checkinDay = date.value;
    renderCheckin();
  };
  for (const dimension of DIMENSIONS) {
    const group = el(
        "fieldset",
        { class: "scale-field" },
        el("legend", {}, v(dimension)),
      ),
      choices = el("div", { class: "scale-choices" });
    for (let n = 1; n <= 5; n++) {
      const b = button(
        String(n),
        () => {
          values[dimension] = n;
          choices
            .querySelectorAll("button")
            .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        },
        {
          "aria-label": v("scale" + n),
          "aria-pressed": String(values[dimension] === n),
          "data-value": n,
        },
      );
      choices.append(b);
    }
    group.append(
      choices,
      el(
        "div",
        { class: "scale-ends" },
        el("span", {}, v("low")),
        el("span", {}, v("high")),
      ),
    );
    form.append(group);
  }
  const note = el(
      "textarea",
      { id: "checkin-note", maxlength: 600, rows: 3, placeholder: v("note") },
      old?.note || "",
    ),
    status = el("p", { role: "status", class: "form-message" });
  form.append(
    el(
      "details",
      { class: "optional-note" },
      el("summary", {}, v("note")),
      note,
    ),
    status,
    el(
      "button",
      { type: "submit", class: "btn-primary", id: "checkin-save" },
      v("save"),
    ),
  );
  form.onsubmit = async (event) => {
    event.preventDefault();
    try {
      const c = await makeCheckin(date.value, { ...values, note: note.value });
      if (account !== state.accountId) return;
      saveWellness("checkin", c, false, version);
      goTo("home");
    } catch {
      status.textContent = DIMENSIONS.some((k) => !values[k])
        ? v("required")
        : v("error");
    }
  };
  if (old)
    form.append(
      button(
        v("remove"),
        () => {
          if (confirm(v("confirmDelete"))) {
            saveWellness("checkin", old, true, version);
            goTo("home");
          }
        },
        { class: "danger-button" },
      ),
    );
  root.append(form);
}
registerScreen("checkin", renderCheckin);

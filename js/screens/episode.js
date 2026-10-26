import { t } from "../i18n.js";
import { state } from "../state.js";
import { goTo, registerScreen } from "../navigation.js";
import { makeEpisode, localDay, episodeEntries } from "../wellness/model.js";
import { saveWellness, recordVersion } from "../sync/runtime.js";
import { el, button, field } from "../wellness/dom.js";
import { v } from "../wellness/copy.js";
export function openEpisode(id = null) {
  state.selectedEpisode = id;
  goTo("episode");
}
export function renderEpisode() {
  const root = document.getElementById("screen-episode");
  root.replaceChildren();
  const old = state.episodes.find((e) => e.id === state.selectedEpisode),
    version = old ? recordVersion(old.id) : 0;
  root.append(
    el(
      "header",
      { class: "page-head" },
      button("← " + v("back"), () => goTo("history")),
      el("p", { class: "eyebrow" }, v("episode")),
      el("h1", {}, old?.title || v("newEpisode")),
      el("p", { class: "muted" }, v("episodeHint")),
    ),
  );
  const title = el("input", {
      id: "episode-title",
      required: "",
      maxlength: 100,
      value: old?.title || "",
      placeholder: v("episodeName"),
    }),
    start = el("input", {
      id: "episode-start",
      type: "date",
      required: "",
      value: old?.startDate || localDay(),
    }),
    end = el("input", {
      id: "episode-end",
      type: "date",
      value: old?.endDate || "",
    }),
    status = el("select", { id: "episode-status" });
  for (const x of ["ongoing", "recovering", "recovered"])
    status.append(
      el(
        "option",
        { value: x, selected: (old?.status || "ongoing") === x },
        v(x),
      ),
    );
  const notes = el(
      "textarea",
      { id: "episode-notes", maxlength: 600, rows: 3 },
      old?.notes || "",
    ),
    message = el("p", { role: "status" }),
    form = el(
      "form",
      { class: "wellness-form" },
      field(v("episodeName"), title),
      field(v("start"), start),
      field(v("end"), end),
      field(v("status"), status),
      field(v("note"), notes),
      message,
      el("button", { type: "submit", class: "btn-primary" }, v("save")),
    );
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      saveWellness(
        "episode",
        makeEpisode(
          {
            title: title.value,
            startDate: start.value,
            endDate: end.value,
            status: status.value,
            notes: notes.value,
          },
          old,
        ),
        false,
        version,
      );
      goTo("history");
    } catch {
      message.textContent = v("episodeInvalid");
    }
  };
  if (old) {
    form.append(
      button(v("chatFrom"), () =>
        window.startContextChat({ period: "all", episodeIds: [old.id] }),
      ),
    );
    form.append(
      button(
        v("remove"),
        () => {
          if (confirm(v("confirmDelete"))) {
            saveWellness("episode", old, true, version);
            goTo("history");
          }
        },
        { class: "danger-button" },
      ),
    );
    const list = el("section", {}, el("h2", {}, v("linked")));
    for (const e of episodeEntries(old, state.entries))
      list.append(
        button(e.date + " · " + e.symptoms.map(t).join(", "), () =>
          window.openEntryModal(e.id),
        ),
      );
    form.append(list);
  }
  root.append(form);
}
registerScreen("episode", renderEpisode);

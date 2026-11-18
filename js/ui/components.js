import { el } from "../wellness/dom.js";
// Small, local 24px outline icons. All decoration has a consistent 2px stroke.
const paths = {
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  arrowLeft: "M19 12H5m6-6-6 6 6 6",
  sun: "M12 3V1m0 22v-2M3 12H1m22 0h-2M4.2 4.2 2.8 2.8m18.4 18.4-1.4-1.4M4.2 19.8l-1.4 1.4M21.2 2.8l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  moon: "M20.5 14.2A9 9 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2Z",
  mail: "M3 5h18v14H3zM3 5l9 7 9-7",
  check: "m5 12 4 4L19 6",
  sparkle: "m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z",
  "heart-pulse": "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8ZM2.5 12h5l2-3 3.5 6 2-3h6.5",
  "plus-circle": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5v10m-5-5h10",
  "messages-square": "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2v-7.5A8.5 8.5 0 0 1 10.5 6H13m8 5.5V4a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v2",
  shield: "M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Zm-4 9 3 3 5-6",
};
export function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24",
    width: 24,
    height: 24,
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  }))
    svg.setAttribute(k, v);
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[name] || paths.sparkle);
  svg.append(path);
  return svg;
}
export function action(
  label,
  onClick,
  { variant = "primary", leading, trailing, ...attrs } = {},
) {
  return el(
    "button",
    {
      type: "button",
      class: "a3-button a3-button--" + variant,
      onclick: onClick,
      ...attrs,
    },
    leading ? icon(leading) : null,
    el("span", {}, label),
    trailing ? icon(trailing) : null,
  );
}
export function badge(label, { accent = "iris" } = {}) {
  return el("span", { class: "a3-badge a3-badge--" + accent }, label);
}

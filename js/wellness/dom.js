export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key.startsWith("on"))
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "text") node.textContent = value;
    else if (["value", "checked", "disabled", "selected"].includes(key))
      node[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity))
    if (child !== null && child !== undefined)
      node.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return node;
}
export const button = (text, action, attrs = {}) =>
  el(
    "button",
    { type: "button", class: "soft-button", onclick: action, ...attrs },
    text,
  );
export function field(label, node) {
  return el("label", { class: "field-label" }, el("span", {}, label), node);
}

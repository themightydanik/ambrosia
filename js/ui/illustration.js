import { el } from "../wellness/dom.js";
import { ariIllustrations } from "./ari-assets.js";
export function illustration(
  name,
  { eager = false, priority = "auto", className = "" } = {},
) {
  const asset = ariIllustrations[name];
  if (!asset) throw Error("Unknown approved Ari illustration: " + name);
  const image = el("img", {
    src: asset.src,
    width: asset.width,
    height: asset.height,
    alt: "",
    loading: eager ? "eager" : "lazy",
    decoding: "async",
    fetchpriority: priority,
    draggable: "false",
  });
  const frame = el(
    "figure",
    {
      class: "a3-illustration " + className,
      "aria-hidden": "true",
      "data-illustration": name,
    },
    image,
  );
  frame.style.aspectRatio = asset.width + " / " + asset.height;
  // Art is decorative. A network failure must never hide the real text or block navigation.
  image.addEventListener("error", () => {
    image.hidden = true;
    frame.dataset.state = "unavailable";
  });
  return frame;
}

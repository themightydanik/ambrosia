import { el } from "./dom.js";
import { v } from "./copy.js";
import { shiftDay } from "./model.js";
export function trendChart(checkins, dimension, end, days = 7) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 300 100");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", v(dimension) + " · " + days + " " + v("days"));
  const points = Array.from({ length: days }, (_, i) => {
    const day = shiftDay(end, i - days + 1),
      c = checkins.find((c) => c.date === day);
    return c
      ? { x: 12 + (i * 276) / (days - 1), y: 86 - (c[dimension] - 1) * 18 }
      : null;
  });
  for (const y of [14, 50, 86]) {
    const line = document.createElementNS(svg.namespaceURI, "path");
    line.setAttribute("d", `M12 ${y}H288`);
    line.setAttribute("class", "chart-gridline");
    svg.append(line);
  }
  let d = "";
  points.forEach((p, i) => {
    if (p) d += (i > 0 && points[i - 1] ? "L" : "M") + p.x + " " + p.y + " ";
  });
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", d);
  path.setAttribute("class", "trend-path");
  svg.append(path);
  for (const p of points.filter(Boolean)) {
    const circle = document.createElementNS(svg.namespaceURI, "circle");
    circle.setAttribute("cx", p.x);
    circle.setAttribute("cy", p.y);
    circle.setAttribute("r", 4);
    circle.setAttribute("class", "trend-dot");
    svg.append(circle);
  }
  return svg;
}

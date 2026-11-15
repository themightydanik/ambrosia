const fs = require("node:fs");
const path = require("node:path");
const runtimeFiles = [
  "index.html",
  "css",
  "js",
  "assets",
  "icons",
  "manifest.json",
  "sw.js",
];
function copyRuntime(out) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const name of runtimeFiles)
    if (fs.existsSync(name))
      fs.cpSync(name, path.join(out, name), { recursive: true });
}
function totalBytes(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .reduce(
      (sum, f) =>
        sum +
        (f.isDirectory()
          ? totalBytes(path.join(dir, f.name))
          : fs.statSync(path.join(dir, f.name)).size),
      0,
    );
}
module.exports = { copyRuntime, totalBytes };

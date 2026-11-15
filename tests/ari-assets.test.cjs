const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const os = require("node:os");
const inventory = require("../source-assets/ari/v1/inventory.json").assets;
test("all 23 release PNGs remain byte-identical, with original dimensions and alpha metadata", () => {
  assert.equal(inventory.length, 23);
  assert.equal(new Set(inventory.map((x) => x.name)).size, 23);
  for (const item of inventory) {
    const data = fs.readFileSync(item.file);
    assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(data.length, item.bytes);
    assert.equal(
      crypto.createHash("sha256").update(data).digest("hex"),
      item.sha256,
    );
    if (item.releaseDigest)
      assert.equal(item.releaseDigest, "sha256:" + item.sha256);
    assert.equal(data.readUInt32BE(16), item.width);
    assert.equal(data.readUInt32BE(20), item.height);
    if (item.mode === "RGBA") {
      assert.equal(data[25], 6);
      assert.equal(item.alpha[0], 0);
      assert.ok(item.alpha[1] > 0);
    }
  }
  assert.equal(
    inventory.filter((x) => x.file.startsWith("assets/")).length,
    10,
  );
});
test("production/native runtime allowlist excludes references, unused source poses, tests and private configuration", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "ambrosia-runtime-"));
  try {
    require("../scripts/runtime-files.cjs").copyRuntime(out);
    assert.ok(
      fs.existsSync(
        path.join(
          out,
          "assets/brand/ari/v1/illustrations/ill-auth-welcome.png",
        ),
      ),
    );
    for (const file of [
      "source-assets",
      "docs",
      "tests",
      ".env",
      "netlify",
      "node_modules",
    ])
      assert.ok(!fs.existsSync(path.join(out, file)));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

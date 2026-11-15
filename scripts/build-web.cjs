const { copyRuntime, totalBytes } = require("./runtime-files.cjs");
copyRuntime("web-dist");
require("./app-links.cjs").writeAssociation("web-dist");
console.log(
  `Production static bundle: ${totalBytes("web-dist")} bytes (original PNGs included; source/reference files excluded).`,
);

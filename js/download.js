import { state } from "./state.js";
let exportEpoch = 0;
window.addEventListener("journal-changed", (event) => {
  if (event.detail?.accountChanged) exportEpoch++;
});
import { isAndroid } from "./platform.js";
// Android WebView cannot reliably download blob: links; use the system share/save sheet.
export async function cleanupNativeExports() {
  if (!isAndroid()) return;
  const { Filesystem, Directory } = await import("./native-sdk.js");
  await Filesystem.rmdir({
    path: "ambrosia-export",
    directory: Directory.Cache,
    recursive: true,
  }).catch(() => {});
}
export async function downloadBlob(blob, name) {
  const user = state.accountId,
    epoch = exportEpoch;
  if (!isAndroid()) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { Filesystem, Directory, Share } = await import("./native-sdk.js");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  if (user !== state.accountId || epoch !== exportEpoch)
    throw Error("ACCOUNT_CHANGED");
  const file =
    "ambrosia-export/" +
    crypto.randomUUID() +
    "-" +
    name.replace(/[^A-Za-z0-9._-]/g, "_");
  const result = await Filesystem.writeFile({
    path: file,
    data,
    directory: Directory.Cache,
    recursive: true,
  });
  try {
    if (user !== state.accountId || epoch !== exportEpoch)
      throw Error("ACCOUNT_CHANGED");
    await Share.share({ files: [result.uri] });
  } finally {
    setTimeout(
      () =>
        Filesystem.deleteFile({ path: file, directory: Directory.Cache }).catch(
          () => {},
        ),
      60000,
    );
  }
}

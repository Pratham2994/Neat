// End to end: the real desktop app (Rust core and UI) on a fake Downloads folder, driven through
// tauri-driver. Checks what the UI shows and what happened on disk after each decision and undo.
//
// Linux only (Tauri's WebDriver support). Needs: Xvfb, WebKitWebDriver, dbus-run-session,
// `cargo install tauri-driver --locked`, and a debug build (`npm run e2e` builds it).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(repo, "target/debug/neat");
const work = mkdtempSync(join(tmpdir(), "neat-e2e-"));
const downloads = join(work, "Downloads");
const shots = join(repo, "e2e/screenshots");
const DRIVER = "http://127.0.0.1:4444";
const DISPLAY = ":99";

// --- A fake Downloads folder. Files are backdated so Neat treats them as settled.
const DAY = 86400;
function put(name, content, ageDays) {
  const path = join(downloads, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  age(path, ageDays);
}
function age(path, ageDays) {
  const when = Date.now() / 1000 - ageDays * DAY;
  utimesSync(path, when, when);
}
// A stored (uncompressed) zip, enough for Neat to read the listing.
function zip(path, files) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text);
    const nameBuf = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  writeFileSync(path, Buffer.concat([...locals, centralBuf, end]));
}

put("Invoice_402-8831127-4432.pdf", "invoice one", 1);
put("order_invoice_18842.pdf", "invoice two", 2);
put("Semester 5 Timetable.pdf", "same timetable bytes", 30);
put("Semester 5 Timetable (1).pdf", "same timetable bytes", 20);
put("Semester 5 Timetable (2).pdf", "same timetable bytes", 10);
put("DBMS_Project_Report.docx", "v1", 9);
put("DBMS_Project_Report_final.docx", "v2 longer", 8);
put("DBMS_Project_Report_final_v2.docx", "v3 longest", 6);
const assets = [
  ["logo.svg", "<svg/>"],
  ["fonts/brand.woff2", "font bytes"],
];
zip(join(downloads, "brand-assets.zip"), assets);
age(join(downloads, "brand-assets.zip"), 5);
for (const [name, text] of assets) put(join("brand-assets", name), text, 5);
age(join(downloads, "brand-assets"), 5);
put("dataset-full.tar.gz.crdownload", "half", 3);
put("wallpaper-1.jpg", "jpg one", 3);
put("wallpaper-2.png", "png two", 4);
put("My Stuff/notes.txt", "mine", 0);

// --- Start the UI dev server (the debug build loads it), a virtual display, and tauri-driver.
const children = [];
const start = (cmd, args, env = {}) => {
  const child = spawn(cmd, args, { cwd: repo, env: { ...process.env, ...env }, stdio: "ignore" });
  children.push(child);
  return child;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const devServerUp = () =>
  fetch("http://localhost:1420")
    .then(() => true)
    .catch(() => false);
if (!(await devServerUp())) start("npx", ["vite", "--port", "1420", "--strictPort"]);
start("Xvfb", [DISPLAY, "-screen", "0", "1280x800x24"]);
await sleep(1000);
start("tauri-driver", ["--port", "4444"], {
  DISPLAY,
  NEAT_DOWNLOADS: downloads,
  // Keeps Neat's history and the trash inside the test folder.
  XDG_DATA_HOME: join(work, "data"),
  XDG_CONFIG_HOME: join(work, "config"),
  WEBKIT_DISABLE_COMPOSITING_MODE: "1",
});
for (let i = 0; i < 60 && !(await devServerUp()); i++) await sleep(500);
await sleep(1500);

// --- A minimal W3C WebDriver client.
async function wd(method, path, body) {
  const res = await fetch(DRIVER + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (json.value?.error) throw new Error(`${path}: ${json.value.error}: ${json.value.message}`);
  return json.value;
}
async function until(what, check, timeout = 20000) {
  for (const t0 = Date.now(); Date.now() - t0 < timeout; await sleep(250)) {
    try {
      if (await check()) return;
    } catch {
      // Not ready yet.
    }
  }
  throw new Error(`timed out waiting for ${what}`);
}

const results = [];
const check = (name, ok) => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
};
const has = (path) => existsSync(join(downloads, path));
let sid;

try {
  sid = (await wd("POST", "/session", { capabilities: { alwaysMatch: { "tauri:options": { application: app } } } })).sessionId;
  const run = (script, args = []) => wd("POST", `/session/${sid}/execute/sync`, { script, args });
  const text = () => run("return document.body.innerText");
  const click = (label) =>
    run(
      "const b = [...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith(arguments[0])); if (b) b.click(); return !!b;",
      [label],
    );
  const press = (key, options = {}) =>
    run("document.body.dispatchEvent(new KeyboardEvent('keydown', { ...arguments[1], key: arguments[0], bubbles: true }))", [
      key,
      options,
    ]);
  const shot = async (name) => {
    mkdirSync(shots, { recursive: true });
    writeFileSync(join(shots, name), Buffer.from(await wd("GET", `/session/${sid}/screenshot`), "base64"));
  };

  await until("the inbox", async () => (await text()).includes("Receipts and invoices"));
  await sleep(500);
  await shot("inbox.png");
  const inbox = await text();
  for (const title of [
    "Unfinished downloads",
    "Same file, downloaded 3 times",
    "Archive already extracted",
    "DBMS Project Report, 3 versions",
    "Receipts and invoices",
    "Images",
  ]) {
    check(`scan finds "${title}"`, inbox.includes(title));
  }
  check("a folder the user made is never grouped", !inbox.includes("My Stuff"));

  check("the row's Move button works", await click("Move to Receipts"));
  await until("the receipts to move", async () => has("Finance/Receipts/Invoice_402-8831127-4432.pdf"));
  check(
    "receipts land in Downloads/Finance/Receipts",
    has("Finance/Receipts/order_invoice_18842.pdf") && !has("Invoice_402-8831127-4432.pdf"),
  );
  check("Neat marks the folder it made", has("Finance/Receipts/.neat"));

  // Undo acts on the confirmation in the status strip, which appears once the core has answered.
  await until("the move confirmation", async () => (await text()).includes("Moved 2 files to Finance/Receipts"));
  await press("z");
  await until("the receipts to come back", async () => has("Invoice_402-8831127-4432.pdf"));
  check("Z puts the receipts back and removes the empty folder", has("order_invoice_18842.pdf") && !has("Finance"));

  await until("the batch button", async () => (await text()).includes("Apply 3 suggestions"));
  check("Apply suggestions works", await click("Apply 3 suggestions"));
  await until("the sure groups to apply", async () => !has("Semester 5 Timetable (1).pdf") && !has("brand-assets.zip"));
  check("duplicate copies recycled, the original kept", !has("Semester 5 Timetable (2).pdf") && has("Semester 5 Timetable.pdf"));
  check("the extracted archive recycled, its folder kept", !has("brand-assets.zip") && has("brand-assets/logo.svg"));
  check("the unfinished download recycled", !has("dataset-full.tar.gz.crdownload"));
  await until("the batch confirmation", async () => (await text()).includes("Applied 3 suggestions"));
  await shot("after-batch.png");

  await press("z");
  await until("the batch to come back", async () => has("Semester 5 Timetable (1).pdf") && has("brand-assets.zip"));
  check(
    "Z restores the whole batch from the trash",
    has("Semester 5 Timetable (2).pdf") && has("dataset-full.tar.gz.crdownload"),
  );

  await press("2", { ctrlKey: true });
  await until("the activity log", async () => (await text()).includes("Everything Neat did"));
  const activity = await text();
  check(
    "the activity log shows the moves and recycles as undone",
    activity.includes("Moved") && activity.includes("Recycled") && activity.includes("Undone"),
  );
  check("the user's folder is untouched", has("My Stuff/notes.txt"));
} catch (error) {
  console.log(`ERROR ${error.message}`);
  results.push(false);
} finally {
  if (sid) await wd("DELETE", `/session/${sid}`).catch(() => {});
  for (const child of children) child.kill();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
console.log(`Folder at the end: ${readdirSync(downloads).sort().join(", ")}`);
rmSync(work, { recursive: true, force: true });
process.exit(failed ? 1 : 0);

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../web/src/demos/processor");
const read = (name) => fs.readFileSync(path.join(dir, name), "utf8");
const app = read("App.tsx");
const css = read("processor.css");
const data = read("data.ts");
const text = app + "\n" + css + "\n" + data;
let fail = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL", msg); fail++; }
}

const leads = [
  "New files land here. Drop one in, then check it before it goes to another program.",
  "These files are waiting on you before they go anywhere.",
  "Files that were sent on, or kept in this shop.",
  "What this program has been doing on this PC.",
  "Where files sit on this PC, and which programs they can go to.",
  "The licence file that sits with this program.",
];
leads.forEach((line) => assert(text.includes(line), "missing lead " + line));
[
  "Drop files here",
  "Choose files",
  "PDF, Word, Excel, drawings, and pictures. Each file is held for you to check.",
  "Send it to",
  "Send to that program",
  "Keep in this shop",
  "Question on the job",
  "Kind of file",
  "Job number",
  "Arrived today",
  "Finished",
  "Need a look",
  "Hours open",
  "Programs a file can go to",
  "File Processor does not replace those programs. It sends the file to the one you pick.",
  "Or keep it in this shop",
  "Files it will take",
  "PDF, Word, Excel, DWG, DXF, and pictures (JPG, PNG, TIFF).",
  "On this PC",
  "What this does",
  "The licence is a file that comes with the install. There is nowhere to type a key.",
  "With no licence in force you can still open Inbox, Review, Filed, and Activity and look at work already here. Sending a file to another program, and filing a new one from this screen, stays off. Files already here are left where they are.",
  "This replica does not install a licence file.",
  "Pick a file to see where it is going.",
  "Sends files to your other programs. Runs on this PC.",
].forEach((line) => assert(text.includes(line), "missing copy " + line));
["This PC", "New files", "Finished files", "Problem files", "Kept here"].forEach((label) => assert(text.includes(label), "missing folder " + label));
["#0a1b30", "#e8eef5", "#f2994a"].forEach((c) => assert(css.includes(c), "missing theme " + c));
["scope_id", "doc_automation", "financier", "archive"].forEach((key) => {
  assert(data.includes(key), "internal key missing from data map " + key);
  assert(!app.includes(key) && !css.includes(key), "internal key visible in the shop UI " + key);
});
["Ask before a file leaves Review", "This install", "What the licence controls", "Action Panel", "shop name"].forEach((bad) => assert(!text.includes(bad), "old copy still present " + bad));
assert(!/<input[^>]*key/i.test(app), "licence key field");

if (fail) { console.error(fail + " failed"); process.exit(1); }
console.log("processor demo ok");

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../web/src/demos/processor");
const text = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".css")).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
let fail = 0;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL", msg); fail++; }
}

["Inbox", "Review", "Filed", "Activity", "Settings", "Licence"].forEach((name) => assert(text.includes(name), "missing screen " + name));
["Takeoff", "Documents", "Bookkeeping", "Keep in this shop"].forEach((name) => assert(text.includes(name), "missing destination " + name));
assert(text.includes("The licence is a file that comes with the install. There is nowhere to type a key."), "missing licence copy");
assert(text.includes("Sends files to your other programs. Runs on this PC."), "missing brand line");
assert(text.includes("This file"), "missing This file panel");
["#0a1b30", "#e8eef5", "#f2994a"].forEach((c) => assert(text.includes(c), "missing theme color " + c));
["scope_id", "doc_automation", "financier", "archive", "Action Panel", "Completion"].forEach((bad) => assert(!text.includes(bad), "forbidden text " + bad));
assert(!/<input[^>]*key/i.test(text), "licence key field");

if (fail) { console.error(fail + " failed"); process.exit(1); }
console.log("processor demo ok");

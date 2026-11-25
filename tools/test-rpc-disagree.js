"use strict";
/* Functional test: when the two public RPCs DISAGREE at the same
   pinned block, the site fails closed — the global stats stay hidden
   and the scan/claim never starts on unverified data.
   jsdom: the second RPC (mschihuahua) is stubbed to return a
   different nextId in its anchor reads; everything else agrees.
   Setup: npm install jsdom (dev-only), then: node tools/test-rpc-disagree.js */
const fs = require("fs");
const { JSDOM } = require("jsdom");

const ADDR = "0x1111111111111111111111111111111111111111";
const W = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");

let html = fs.readFileSync(__dirname + "/../docs/ja.html", "utf8");
html = html.replace(/<script src="app\.js[^"]*"><\/script>/, "");
const appJs = fs.readFileSync(__dirname + "/../docs/app.js", "utf8");

const dom = new JSDOM(html, { url: "https://cat.id42.win/ja.html", runScripts: "dangerously", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

window.ethereum = {
  isMetaMask: true,
  request: async ({ method }) => {
    switch (method) {
      case "eth_requestAccounts": return [ADDR];
      case "eth_accounts": return [ADDR];
      case "eth_chainId": return "0x66c9a";
      case "eth_getTransactionReceipt": return null;
      default: throw new Error("unexpected method " + method);
    }
  },
  on: () => {}
};
window.fetch = async (url, opts) => {
  const payload = JSON.parse(opts.body);
  if (!Array.isArray(payload)) {
    if (payload.method === "eth_blockNumber") return { ok: true, json: async () => ({ jsonrpc: "2.0", id: payload.id, result: "0x1000" }) };
    throw new Error("unexpected single request " + payload.method);
  }
  const lying = String(url).includes("mschihuahua");
  const out = payload.map((c) => {
    const sel = c.params[0].data.slice(0, 10);
    let result = W(0n);
    if (sel === "0x61b8ce8c") result = W(lying ? 9999n : 3n);        // nextId — the lie
    else if (sel === "0xdcc59b6f") result = W(10n);                  // claims()
    else if (sel === "0x70a08231") result = W(1000000000000000000000n); // balanceOf
    return { jsonrpc: "2.0", id: c.id, result };
  });
  return { ok: true, json: async () => out };
};

let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? "PASS" : "FAIL") + " " + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const waitFor = async (fn, what) => {
  for (let i = 0; i < 200; i++) { if (fn()) return true; await new Promise(r => setTimeout(r, 25)); }
  throw new Error("timeout waiting for " + what);
};

(async () => {
  window.eval(appJs);
  const $ = (id) => document.getElementById(id);

  // Stats: disagreement -> numbers stay hidden, warning shown
  await waitFor(() => $("statsError").textContent.length > 0, "stats disagreement warning");
  check("stats numbers stay hidden on disagreement", $("statClaims").textContent === "—" && $("statGuides").textContent === "—");
  check("stats warning explains the disagreement", $("statsError").textContent.includes("違うデータが返ってきたため"), $("statsError").textContent);

  // Connect + scan: anchors disagree -> fail closed before any scan
  $("connectBtn").click();
  await waitFor(() => $("connectResult").textContent.includes("違うデータが返ってきたため"), "scan blocked by disagreement");
  check("account itself connected (wallet side is fine)", !$("accountBox").hidden);
  check("scan never starts: claim panel stays hidden", $("mainPanel").hidden === true);
  check("connect result shows the disagreement warning", true);

  console.log(failures === 0 ? "ALL RPC-DISAGREE CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("TEST ERROR", e); process.exit(2); });

"use strict";
/* Functional test: the connect button is ALWAYS shown, wallet
   detection happens at click time, and a wallet injected AFTER page
   load (as wallet in-app browsers often do) still connects.
   jsdom + stubbed RPC; the wallet starts absent on purpose.
   Setup: npm install jsdom (dev-only), then: node tools/test-late-inject.js */
const fs = require("fs");
const { JSDOM } = require("jsdom");

const ADDR = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";
const GUIDE = "0xF349E469C474048DEd6F9b914309E76880ED1bbD".toLowerCase();
const W = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");
const AW = (a) => "0x" + "0".repeat(24) + a.slice(2).toLowerCase();

let html = fs.readFileSync(__dirname + "/../docs/ja.html", "utf8");
html = html.replace(/<script src="app\.js[^"]*"><\/script>/, "");
const appJs = fs.readFileSync(__dirname + "/../docs/app.js", "utf8");

const dom = new JSDOM(html, { url: "https://cat.id42.win/ja.html", runScripts: "dangerously", pretendToBeVisual: true });
const { window } = dom;
const { document } = window;

/* RPC stub only — NO window.ethereum yet: the wallet is "not injected". */
window.fetch = async (url, opts) => {
  const payload = JSON.parse(opts.body);
  if (!Array.isArray(payload)) {
    if (payload.method === "eth_blockNumber") return { ok: true, json: async () => ({ jsonrpc: "2.0", id: payload.id, result: "0x1000" }) };
    throw new Error("unexpected single request " + payload.method);
  }
  const out = payload.map((c) => {
    const to = (c.params[0].to || "").toLowerCase();
    const d = c.params[0].data;
    const sel = d.slice(0, 10);
    const arg = d.length >= 74 ? BigInt("0x" + d.slice(10, 74)) : 0n;
    let result = W(0n);
    if (sel === "0x61b8ce8c") result = W(3n);
    else if (sel === "0xdcc59b6f") result = W(10n);
    else if (sel === "0x70a08231") result = to === GUIDE ? W(1n) : W(1000000000000000000000n);
    else if (sel === "0x6352211e") result = AW(arg === 2n ? ADDR : OTHER);
    else if (sel === "0xdbe7e3bd") result = W(0n);
    else if (sel === "0xc317c377") result = W(1000n);
    else if (sel === "0x6dda34db") result = W(0n);
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
  await new Promise(r => setTimeout(r, 100));

  // 1) No wallet at load: button shown, guidance NOT shown preemptively
  check("connect button is shown without a wallet", !$("connectBox").hidden && !!$("connectBtn"));
  check("no-wallet guidance stays hidden at load", $("noWalletPanel").hidden === true);

  // 2) Click with truly no wallet: guidance appears, button STAYS
  $("connectBtn").click();
  await waitFor(() => !$("noWalletPanel").hidden, "guidance after click without wallet");
  check("guidance appears only after a click finds no wallet", true);
  check("connect button still shown next to the guidance", !$("connectBox").hidden);
  check("account panel still hidden", $("accountBox").hidden === true);

  // 3) The wallet injects late (in-app browser timing) -> next click connects
  const listeners = {};
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
    on: (ev, fn) => { listeners[ev] = fn; }
  };
  $("connectBtn").click();
  await waitFor(() => !$("accountBox").hidden && !$("mainPanel").hidden, "connected after late injection");
  check("late-injected wallet connects on the next click", $("walletAddr").textContent === ADDR);
  check("guidance hides again once a wallet is found", $("noWalletPanel").hidden === true);

  // 4) Provider events were wired lazily for the late provider
  check("accountsChanged wired for the late provider", typeof listeners["accountsChanged"] === "function");
  listeners["accountsChanged"]([]);
  check("accountsChanged([]) resets the UI", $("accountBox").hidden && !$("connectBox").hidden);

  // 5) With no session, a wallet-side account switch must NOT connect
  listeners["accountsChanged"]([OTHER]);
  await new Promise(r => setTimeout(r, 150));
  check("wallet-side switch does not silently connect", $("accountBox").hidden && $("mainPanel").hidden && $("walletAddr").textContent === "—");

  console.log(failures === 0 ? "ALL LATE-INJECTION CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("TEST ERROR", e); process.exit(2); });

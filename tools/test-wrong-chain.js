"use strict";
/* Functional test: connecting while the wallet is on the WRONG chain
   lands in a chain-pending state (account shown, switch button
   offered, claim panel hidden) instead of the old dead end, and the
   switch button then completes the connection.
   jsdom + stubbed wallet/RPC. Setup: npm install jsdom (dev-only),
   then: node tools/test-wrong-chain.js */
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

let chainNow = "0x1"; // wrong chain at first
window.ethereum = {
  isMetaMask: true,
  request: async ({ method }) => {
    switch (method) {
      case "eth_requestAccounts": return [ADDR];
      case "eth_accounts": return [ADDR];
      case "eth_chainId": return chainNow;
      case "wallet_switchEthereumChain": throw new Error("switch rejected in wallet");
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

  $("connectBtn").click();
  await waitFor(() => !$("accountBox").hidden, "chain-pending state");
  check("account panel shows in the chain-pending state", $("walletAddr").textContent === ADDR);
  check("switch-chain button is offered (reachable, not buried)", $("switchChainBtn").hidden === false);
  check("claim panel stays hidden until the chain is right", $("mainPanel").hidden === true);
  check("wrong-chain message is shown", $("connectResult").textContent.includes("別のネットワーク"), $("connectResult").textContent);
  check("connect button re-enabled after the attempt", $("connectBtn").disabled === false);

  // The wallet is now on 42 Chain (the switch succeeds this time).
  chainNow = "0x66c9a";
  $("switchChainBtn").click();
  await waitFor(() => !$("mainPanel").hidden, "scan after switching");
  check("switch button completes the connection and scans", true);
  check("switch button hides again after success", $("switchChainBtn").hidden === true);
  check("claim button enabled for the stub guide", $("claimBtn").disabled === false);

  console.log(failures === 0 ? "ALL WRONG-CHAIN CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("TEST ERROR", e); process.exit(2); });

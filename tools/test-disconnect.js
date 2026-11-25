"use strict";
/* Functional test of the disconnect UI (qomdex.com pattern), run in
   jsdom with a stubbed wallet + stubbed RPC. No real wallet and no
   transactions: eth_requestAccounts / wallet_revokePermissions are
   answered by the stub and recorded.
   Setup: npm install jsdom (dev-only, not a site dependency), then
   run: node tools/test-disconnect.js */
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

/* jsdom does not implement <dialog>.showModal (verified: undefined in
   jsdom 31). Real browsers all ship it, and the qomdex reference uses
   it too — polyfill the two methods with their real semantics so the
   flow can be exercised end to end. */
if (typeof window.HTMLDialogElement.prototype.showModal !== "function") {
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
}

let revokeParams = null;
const listeners = {};
window.ethereum = {
  isMetaMask: true,
  request: async ({ method, params }) => {
    switch (method) {
      case "eth_requestAccounts": return [ADDR];
      case "eth_accounts": return [ADDR];
      case "eth_chainId": return "0x66c9a";
      case "wallet_revokePermissions": revokeParams = params; return null;
      case "eth_getTransactionReceipt": return null;
      default: throw new Error("unexpected method " + method);
    }
  },
  on: (ev, fn) => { listeners[ev] = fn; }
};
window.fetch = async (url, opts) => {
  const payload = JSON.parse(opts.body);
  const out = payload.map((c) => {
    const to = (c.params[0].to || "").toLowerCase();
    const d = c.params[0].data;
    const sel = d.slice(0, 10);
    const arg = d.length >= 74 ? BigInt("0x" + d.slice(10, 74)) : 0n;
    let result = W(0n);
    if (sel === "0x61b8ce8c") result = W(3n);                        // nextId
    else if (sel === "0xdcc59b6f") result = W(10n);                  // claims()
    else if (sel === "0x70a08231") result = to === GUIDE ? W(1n) : W(1000000000000000000000n); // balanceOf
    else if (sel === "0x6352211e") result = AW(arg === 2n ? ADDR : OTHER); // ownerOf
    else if (sel === "0xdbe7e3bd") result = W(0n);                   // claimed
    else if (sel === "0xc317c377") result = W(1000n);                // preview
    else if (sel === "0x6dda34db") result = W(0n);                   // tier
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

  // dialog exists in the DOM but stays closed while disconnected
  check("dialog present, closed at start", !!$("connDlg") && $("connDlg").open === false);
  check("header pill starts as ウォレット接続", $("headerConnectBtn").textContent === "ウォレット接続", $("headerConnectBtn").textContent);

  // connect
  $("connectBtn").click();
  await waitFor(() => !$("accountBox").hidden && !$("mainPanel").hidden, "connected + scanned state");
  check("account panel shows after connect", $("walletAddr").textContent === ADDR);
  check("scan found the stub guide (claim enabled)", $("claimBtn").disabled === false);
  await waitFor(() => $("headerConnectBtn").classList.contains("connected"), "header pill connected state");
  check("header pill shows shortened address", $("headerConnectBtn").textContent === "0x1111…1111", $("headerConnectBtn").textContent);

  // header pill opens the dialog with the FULL address
  $("headerConnectBtn").click();
  check("dialog opens from header pill", $("connDlg").open === true);
  check("dialog shows the full address", $("connAddr").textContent === ADDR, $("connAddr").textContent);
  check("dialog title is ウォレット接続中", $("connectedTitle").textContent === "ウォレット接続中", $("connectedTitle").textContent);

  // close button closes without disconnecting
  $("connClose").click();
  check("close button closes the dialog", $("connDlg").open === false);
  check("still connected after close", !$("accountBox").hidden);

  // account-panel entry opens the same dialog
  $("disconnectOpenBtn").click();
  check("dialog opens from account panel button", $("connDlg").open === true);

  // disconnect: revokePermissions + full UI reset
  $("disconnectBtn").click();
  await waitFor(() => $("accountBox").hidden, "UI reset after disconnect");
  check("wallet_revokePermissions called for eth_accounts", JSON.stringify(revokeParams) === JSON.stringify([{ eth_accounts: {} }]), JSON.stringify(revokeParams));
  check("dialog closed after disconnect", $("connDlg").open === false);
  check("connect box back, main panel hidden", !$("connectBox").hidden && $("mainPanel").hidden);
  check("disconnected message shown", $("connectResult").textContent.includes("接続を解除しました"), $("connectResult").textContent);
  await waitFor(() => !$("headerConnectBtn").classList.contains("connected"), "header pill reset");
  check("header pill back to ウォレット接続", $("headerConnectBtn").textContent === "ウォレット接続", $("headerConnectBtn").textContent);

  // accountsChanged([]) path still resets (refactored resetWalletUI)
  $("connectBtn").click();
  await waitFor(() => !$("accountBox").hidden, "reconnected");
  listeners["accountsChanged"]([]);
  check("accountsChanged([]) resets the UI", $("accountBox").hidden && !$("connectBox").hidden && $("mainPanel").hidden);

  console.log(failures === 0 ? "ALL FUNCTIONAL CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("TEST ERROR", e); process.exit(2); });

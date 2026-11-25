"use strict";
/* Headless verification harness — requires the SAME functions as docs/app.js.
   Run: node tools/verify.js
   The site fee (prepaid ZAP burn) and the in-page ZAP faucet were abolished
   on 2026-11-14; this harness asserts they are GONE, and keeps the live
   read-only scan checks (no transaction is ever sent).
   Section 9 asserts the 2026-11-24 audit hardening stays in place. */
const fs = require("fs");
const path = require("path");
const app = require("../docs/app.js");

function decodeClaimMany(data) {
  const sel = data.slice(0, 10);
  const body = data.slice(10);
  const words = [];
  for (let i = 0; i + 64 <= body.length; i += 64) words.push(BigInt("0x" + body.slice(i, i + 64)));
  return { selector: sel, offset: words[0], length: Number(words[1]), ids: words.slice(2).map(Number) };
}

function idsOf(html) {
  const out = new Set();
  const re = /id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return out;
}

(async () => {
  let failures = 0;
  const check = (name, ok, detail) => {
    console.log((ok ? "PASS" : "FAIL") + " " + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
  };

  const appJs = fs.readFileSync(path.join(__dirname, "..", "docs", "app.js"), "utf8");
  const enHtml = fs.readFileSync(path.join(__dirname, "..", "docs", "en.html"), "utf8");
  const jaHtml = fs.readFileSync(path.join(__dirname, "..", "docs", "ja.html"), "utf8");

  // 1) claimMany calldata round-trip for [4250, 4251]
  const enc = app.encodeClaimMany([4250, 4251]);
  const dec = decodeClaimMany(enc);
  console.log("claimMany calldata:", enc);
  check("claimMany selector", dec.selector === "0x925489a8", dec.selector);
  check("claimMany offset", dec.offset === 32n, String(dec.offset));
  check("claimMany length", dec.length === 2, String(dec.length));
  check("claimMany ids", JSON.stringify(dec.ids) === JSON.stringify([4250, 4251]), JSON.stringify(dec.ids));

  // 2) global stats (live)
  const stats = await app.getGlobalStats();
  console.log("global stats:", JSON.stringify(stats), "vault CAT42 ≈", stats.vaultWei ? app.formatCAT(BigInt(stats.vaultWei)) : null);
  check("global claims is number", typeof stats.claims === "number" && stats.claims > 0, String(stats.claims));
  check("global vault > 0", !!stats.vaultWei && BigInt(stats.vaultWei) > 0n, stats.vaultWei);
  check("global guides issued > 0", typeof stats.guideIssued === "number" && stats.guideIssued > 0, String(stats.guideIssued));

  // 3) big holder scan: found-owned MUST equal balanceOf
  const A1 = "0x0E2E4b54A1E2FF313B91EA2f5Bca3B6152a592B0";
  let lastProgress = "";
  const s1 = await app.scanOwnedGuides(A1, { onProgress: (d, t) => { lastProgress = d + "/" + t; } });
  console.log(`scan ${A1}: progress=${lastProgress} owned=${s1.ownedIds.length} balanceOf=${s1.balanceOfCount} claimed=${s1.claimedIds.length} unclaimed=${s1.unclaimed.length} totalPreview=${app.formatCAT(BigInt(s1.totalPreviewWei))} CAT42 mismatch=${s1.mismatch} totalGuides=${s1.totalGuides}`);
  check("A1 owned == balanceOf", s1.ownedIds.length === s1.balanceOfCount, `owned=${s1.ownedIds.length} balanceOf=${s1.balanceOfCount}`);
  check("A1 mismatch flag false", s1.mismatch === false);
  check("A1 owned+split consistent", s1.claimedIds.length + s1.unclaimed.length === s1.ownedIds.length);

  // 4) small holder: IDs 32,36,73,79,86 owned+unclaimed with preview > 0
  const A2 = "0x7a8C5b813855B95663a29205BeC9Dd5bf0289fb4";
  const s2 = await app.scanOwnedGuides(A2, {});
  console.log(`scan ${A2}: owned=${JSON.stringify(s2.ownedIds)} balanceOf=${s2.balanceOfCount} claimed=${JSON.stringify(s2.claimedIds)} unclaimed=${JSON.stringify(s2.unclaimed.map(u => ({ id: u.id, tier: u.tier, preview: app.formatCAT(BigInt(u.previewWei)) })))}`);
  check("A2 owned == balanceOf", s2.ownedIds.length === s2.balanceOfCount, `owned=${s2.ownedIds.length} balanceOf=${s2.balanceOfCount}`);
  for (const want of [32, 36, 73, 79, 86]) {
    const u = s2.unclaimed.find(x => x.id === want);
    check(`A2 guide #${want} owned+unclaimed preview>0`, !!u && BigInt(u.previewWei) > 0n, u ? `tier=${u.tier} preview=${app.formatCAT(BigInt(u.previewWei))}` : "not in unclaimed list");
  }

  // 5) scan off-by-one fix (commit 0155abb) is still in place
  check("scan comment: IDs 1..nextId INCLUSIVE", appJs.includes("1..nextId INCLUSIVE"));
  check("scan loop includes nextId (i <= total)", appJs.includes("for (var i = 1; i <= total; i++)"));
  check("guideIssued is nextId as-is (no - 1)", appJs.includes("guideIssued: res[2] ? Number(decodeUint(res[2])) : null"));
  check("rpcBatch null-entry retry present", appJs.includes("missing.length && j + 1 < order.length"));

  // 6) site fee + ZAP faucet: every trace removed from app.js
  const BANNED = [
    "computeFeeWei", "computeClaimAccess", "evaluateFee", "renderGate", "hideLists",
    "honoredClaimIds", "idsFingerprint", "quoteZapOut", "getZapBalance", "getErc20Balance",
    "encodeTransfer", "encodeGetAmountsOut", "decodeAmountsOut", "receiptBurnVerified",
    "TRANSFER_TOPIC", "parseDecimalToWei", "parseZapFaucetStatus", "parseZapClaimResponse",
    "buildZapClaimBody", "fetchZapFaucetStatus", "claimZapFaucet", "gateAfterFaucetClaim",
    "faucetErrorKey", "FAUCET_ERR_CODES", "FAUCET_BASE", "42-faucet",
    "FEE_NUM", "FEE_DEN", "PENDING_FEE_KEY", "BURN_ADDRESS",
    "feePanel", "feeBox", "faucetPanel", "feeResumeBtn", "feeFaucetBtn",
    "faucetClaimBtn", "faucetRefreshBtn", "formatZap", "claimBtnLocked",
    "swapExactTokensForTokens", "encodeApprove", "getAmountsOut", "0x000000000000000000000000000000000000dEaD"
  ];
  for (const b of BANNED) {
    check(`app.js has no trace of ${b}`, !appJs.includes(b));
  }
  for (const fn of ["computeFeeWei", "computeClaimAccess", "quoteZapOut", "getZapBalance", "receiptBurnVerified", "claimZapFaucet", "fetchZapFaucetStatus", "honoredClaimIds", "idsFingerprint", "formatZap"]) {
    check(`export ${fn} is gone`, typeof app[fn] === "undefined");
  }
  check("SEL has no transfer selector", app.SEL.transfer === undefined);
  check("SEL has no getAmountsOut selector", app.SEL.getAmountsOut === undefined);
  check("no ZAP/ROUTER/BURN constants exported", app.ZAP === undefined && app.ROUTER === undefined && app.BURN_ADDRESS === undefined);
  check("startup cleanup removes prepaid v2 record", appJs.includes('localStorage.removeItem("cat42claim_prepaid_fee_v2")'));
  check("startup cleanup removes legacy v1 record", appJs.includes('localStorage.removeItem("cat42claim_pending_fee_v1")'));

  // 7) i18n: EN/JA key sets identical, no fee/faucet keys, plain claim wording
  const enKeys = Object.keys(app.I18N.en).sort();
  const jaKeys = Object.keys(app.I18N.ja).sort();
  check("i18n EN/JA key sets identical", JSON.stringify(enKeys) === JSON.stringify(jaKeys), `${enKeys.length} keys`);
  check("i18n has no fee/faucet keys", !enKeys.some(k => /^(fee|faucet)/.test(k)) && !jaKeys.some(k => /^(fee|faucet)/.test(k)));
  check("i18n EN step3 is the plain claim step", app.I18N.en.step3 === "Tap once to claim everything", app.I18N.en.step3);
  check("i18n JA step3 is the plain claim step", app.I18N.ja.step3 === "ボタンを1回押して全部受け取る", app.I18N.ja.step3);
  check("i18n EN claimBtn plain", app.I18N.en.claimBtn === "Claim all", app.I18N.en.claimBtn);
  check("i18n JA claimBtn plain", app.I18N.ja.claimBtn === "まとめて全部もらう", app.I18N.ja.claimBtn);
  check("i18n EN howNote keeps the network (gas) fee line", app.I18N.en.howNote.includes("network fee (in [42])"));
  check("i18n JA howNote keeps the network (gas) fee line", app.I18N.ja.howNote.includes("ネットワークの手数料として少しだけ [42]"));
  const allStrings = JSON.stringify(app.I18N);
  check("i18n mentions no ZAP", !/ZAP/.test(allStrings));
  check("i18n mentions no faucet", !/faucet|フォーセット/i.test(allStrings));
  check("i18n mentions no site fee", !allStrings.includes("site fee") && !allStrings.includes("サイト手数料"));

  // 8) HTML shells: fee/faucet markup gone, id sets identical, claim UI intact
  for (const [name, html] of [["en.html", enHtml], ["ja.html", jaHtml]]) {
    for (const id of ["faucetPanel", "feePanel", "feeBox"]) {
      check(`${name} has NO #${id}`, !html.includes(`id="${id}"`));
    }
    check(`${name} has #claimBtn`, html.includes('id="claimBtn"'));
    check(`${name} has #mainPanel`, html.includes('id="mainPanel"'));
    check(`${name} loads app.js?v=8`, html.includes("app.js?v=8"));
    check(`${name} loads style.css?v=6`, html.includes("style.css?v=6"));
    check(`${name} mentions no faucet/fee markup`, !/faucet|feePanel|feeBox/.test(html));
  }
  const enIds = [...idsOf(enHtml)].sort();
  const jaIds = [...idsOf(jaHtml)].sort();
  check("en.html / ja.html element-id sets identical", JSON.stringify(enIds) === JSON.stringify(jaIds), `${enIds.length} ids`);
  const jsIds = new Set([...appJs.matchAll(/\$\("([A-Za-z]+)"\)/g)].map(m => m[1]));
  const missing = [...jsIds].filter(id => !idsOf(enHtml).has(id));
  check("every id app.js uses exists in the shells", missing.length === 0, missing.join(","));

  // 9) audit hardening (2026-11-24) regression checks
  check("claim verifies the chain before sending (kind chain)", appJs.includes('kind: "chain"') && appJs.includes("chainIs42"));
  check("receipt timeout is a distinct outcome (kind timeout)", appJs.includes('kind: "timeout"'));
  check("claimTimeout copy exists (en/ja)", typeof app.I18N.en.claimTimeout === "string" && typeof app.I18N.ja.claimTimeout === "string");
  check("claimPartial copy exists (en/ja)", typeof app.I18N.en.claimPartial === "string" && typeof app.I18N.ja.claimPartial === "string");
  check("scan fails closed on a dropped claimed() read", appJs.includes("claimed read failed"));
  check("scan fails closed on a dropped preview() read", appJs.includes("preview read failed"));
  check("scan nextId sanity cap present", appJs.includes("nextId out of range"));
  check("claim snapshots the address (var addr)", appJs.includes("var addr = state.address"));
  for (const [name, html] of [["en.html", enHtml], ["ja.html", jaHtml]]) {
    check(`${name} token icon is self-hosted`, html.includes('src="cat42-icon.jpg"') && !html.includes("raw.githubusercontent.com"));
  }

  // 10) fail-closed scan behaviour, unit-tested against a stubbed RPC
  {
    const W = (v) => "0x" + BigInt(v).toString(16).padStart(64, "0");
    const AW = (a) => "0x" + "0".repeat(24) + a.slice(2).toLowerCase();
    const OWNER = "0x1111111111111111111111111111111111111111";
    const OTHER = "0x2222222222222222222222222222222222222222";
    const realFetch = global.fetch;
    const stub = (mode) => async (url, opts) => {
      const payload = JSON.parse(opts.body);
      const out = payload.map((c) => {
        const d = c.params[0].data;
        const sel = d.slice(0, 10);
        const arg = d.length >= 74 ? BigInt("0x" + d.slice(10, 74)) : 0n;
        let result = null;
        if (sel === app.SEL.nextId) result = mode === "huge" ? W(2000000n) : W(3n);
        else if (sel === app.SEL.balanceOf) result = W(1n);
        else if (sel === app.SEL.ownerOf) result = AW(arg === 2n ? OWNER : OTHER);
        else if (sel === app.SEL.claimed) { if (mode === "dropClaimed") return { jsonrpc: "2.0", id: c.id, error: { code: -32000, message: "stub drop" } }; result = W(0n); }
        else if (sel === app.SEL.preview) { if (mode === "dropPreview") return { jsonrpc: "2.0", id: c.id, error: { code: -32000, message: "stub drop" } }; result = W(1000n); }
        else if (sel === "0x6dda34db") result = W(0n); // tier()
        return { jsonrpc: "2.0", id: c.id, result };
      });
      return { ok: true, json: async () => out };
    };
    const expectThrow = async (mode, needle) => {
      global.fetch = stub(mode);
      try { await app.scanOwnedGuides(OWNER, {}); return false; }
      catch (e) { return String(e && e.message).includes(needle); }
      finally { global.fetch = realFetch; }
    };
    check("stubbed scan: dropped claimed() read fails the scan", await expectThrow("dropClaimed", "claimed read failed"));
    check("stubbed scan: dropped preview() read fails the scan", await expectThrow("dropPreview", "preview read failed"));
    check("stubbed scan: absurd nextId is rejected", await expectThrow("huge", "nextId out of range"));
    global.fetch = stub("ok");
    try {
      const sOk = await app.scanOwnedGuides(OWNER, {});
      check("stubbed scan: healthy reads still scan fine", sOk.ownedIds.length === 1 && sOk.unclaimed.length === 1 && sOk.unclaimed[0].id === 2, JSON.stringify(sOk.ownedIds));
    } catch (e) { check("stubbed scan: healthy reads still scan fine", false, String(e && e.message)); }
    finally { global.fetch = realFetch; }
  }

  // 11) disconnect UI, qomdex.com pattern (added 2026-11-25)
  check("disconnect calls wallet_revokePermissions", appJs.includes("wallet_revokePermissions"));
  check("disconnect revokes eth_accounts permission", appJs.includes("params: [{ eth_accounts: {} }]"));
  check("dialog opener exposed for the header button", appJs.includes("window.__cat42OpenConnDialog = openConnDialog"));
  check("disconnect copy exists (en/ja)", typeof app.I18N.en.disconnectBtn === "string" && typeof app.I18N.ja.disconnectBtn === "string"
    && typeof app.I18N.en.connectedTitle === "string" && typeof app.I18N.ja.connectedTitle === "string"
    && typeof app.I18N.en.disconnected === "string" && typeof app.I18N.ja.disconnected === "string");
  for (const [name, html] of [["en.html", enHtml], ["ja.html", jaHtml]]) {
    for (const id of ["connDlg", "connAddr", "disconnectBtn", "connClose", "disconnectOpenBtn", "connectedTitle"]) {
      check(`${name} has #${id}`, html.includes(`id="${id}"`));
    }
    check(`${name} header button opens the disconnect dialog`, html.includes("__cat42OpenConnDialog"));
    check(`${name} has the dialog element`, html.includes('<dialog id="connDlg"'));
  }

  // 12) 42 logo application (added 2026-11-25): favicon + header chain badge
  const indexHtml = fs.readFileSync(path.join(__dirname, "..", "docs", "index.html"), "utf8");
  for (const f of ["logo42.png", "favicon.png", "apple-touch-icon.png"]) {
    check(`docs/${f} exists`, fs.existsSync(path.join(__dirname, "..", "docs", f)));
  }
  for (const [name, html] of [["en.html", enHtml], ["ja.html", jaHtml]]) {
    check(`${name} has the favicon link`, html.includes('<link rel="icon" type="image/png" href="favicon.png">'));
    check(`${name} has the apple-touch-icon link`, html.includes('<link rel="apple-touch-icon" href="apple-touch-icon.png">'));
    check(`${name} header carries the 42 chain badge`, html.includes('class="chain-badge" src="logo42.png"'));
  }
  check("index.html has the favicon link", indexHtml.includes('<link rel="icon" type="image/png" href="favicon.png">'));

  // 13) Japanese copy rule (2026-11-25): every kanji in the Japanese copy
  // must be in the jōyō list (2,136 chars, 2010 revised table); words
  // whose kanji are outside the list are written in hiragana instead
  // (e.g. つなぐ, もらう). List: tools/joyo-kanji.txt, extracted from
  // the Wikipedia "List of jōyō kanji" table (count validated = 2136).
  const joyo = new Set(fs.readFileSync(path.join(__dirname, "joyo-kanji.txt"), "utf8"));
  check("jōyō reference list holds exactly 2136 characters", joyo.size === 2136, String(joyo.size));
  const isKanji = (ch) => { const c = ch.codePointAt(0); return (c >= 0x3400 && c <= 0x4DBF) || (c >= 0x4E00 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF) || (c >= 0x20000 && c <= 0x2A6DF); };
  const nonJoyoIn = (text) => [...new Set([...String(text)].filter((ch) => isKanji(ch) && !joyo.has(ch)))];
  for (const [k, v] of Object.entries(app.I18N.ja)) {
    check(`I18N.ja.${k} uses jōyō kanji only`, nonJoyoIn(v).length === 0, nonJoyoIn(v).join(""));
  }
  for (const [name, text] of [["ja.html", jaHtml], ["index.html", indexHtml], ["app.js (raw)", appJs]]) {
    check(`${name} uses jōyō kanji only`, nonJoyoIn(text).length === 0, nonJoyoIn(text).join(""));
  }

  // 14) Connect button is ALWAYS shown (2026-11-25): wallet detection
  // happens at click time, never at load — wallet in-app browsers often
  // inject window.ethereum late. The guidance panel may appear only
  // after a click finds no wallet, and must hide again once one is found.
  // (End-to-end behaviour: tools/test-late-inject.js, jsdom.)
  check("page load never pre-shows the no-wallet guidance", !/applyI18n\(\);\s*if \(!hasWallet\(\)\)/.test(appJs));
  check("connect() shows the guidance only when a click finds no wallet",
    appJs.includes('if (!hasWallet()) { $("noWalletPanel").hidden = false; return; }'));
  check("connect() hides the guidance again once a wallet is found",
    appJs.includes('$("noWalletPanel").hidden = true;'));
  check("provider events wire lazily (late-injected wallets included)",
    appJs.includes("function wireProviderEvents()") && appJs.includes("wiredProvider === window.ethereum"));

  // 15) Full-audit fixes (2026-11-25): connect in-flight guard and
  // -32002 tolerance; connect verifies the chain and lands in a
  // reachable chain-pending state; claim timeouts never count an
  // unconfirmed chunk as done (confirmed counter); receipt polling
  // tolerates transient read errors; scans are sequence-guarded; a
  // wallet-side account switch cannot silently connect.
  // (Behaviour: tools/test-wrong-chain.js, tools/test-late-inject.js.)
  check("connect() has an in-flight guard", appJs.includes("if (state.connecting) return;") && appJs.includes("state.connecting = false;"));
  check("connect() tolerates an already-pending wallet prompt (-32002)", appJs.includes("e.code === -32002"));
  check("connect() verifies the chain after the switch attempt", appJs.includes("chainOk") && appJs.includes('cur.toLowerCase() === CHAIN_ID_HEX'));
  check("claim counts only confirmed chunks", appJs.includes("var confirmed = 0;") && appJs.includes('t("claimPartial", { done: confirmed, total: chunks.length })'));
  check("timeout branch reports the timeout before any partial line", appJs.indexOf('e.kind === "timeout"') < appJs.indexOf('} else if (partial) {'));
  check("receipt polling tolerates transient read errors", appJs.includes("transient read error: keep polling"));
  check("scans are sequence-guarded", appJs.includes("var seq = ++state.scanSeq;") && appJs.includes("if (seq !== state.scanSeq) return;"));
  check("wallet-side account switch cannot silently connect", appJs.includes("if (!state.address) return;"));

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });

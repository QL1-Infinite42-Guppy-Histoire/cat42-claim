"use strict";
/* Headless verification harness — requires the SAME functions as docs/app.js.
   Run: node tools/verify.js */
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

function wordsOf(data) {
  const body = data.slice(10);
  const words = [];
  for (let i = 0; i + 64 <= body.length; i += 64) words.push(body.slice(i, i + 64));
  return words;
}
const wordAddr = (w) => ("0x" + w.slice(24)).toLowerCase();
const wordUint = (w) => BigInt("0x" + w);

(async () => {
  let failures = 0;
  const check = (name, ok, detail) => {
    console.log((ok ? "PASS" : "FAIL") + " " + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
  };

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

  // 5) prepaid fee math: 5% of the preview total (the estimate), floor, zero case
  const E18 = 10n ** 18n;
  check("fee 5% of 374 CAT42 estimate", app.computeFeeWei(374n * E18) === 187n * E18 / 10n, app.formatCAT(app.computeFeeWei(374n * E18)));
  check("fee floor (101 wei -> 5)", app.computeFeeWei(101n) === 5n, String(app.computeFeeWei(101n)));
  check("fee zero case (19 wei -> 0)", app.computeFeeWei(19n) === 0n);
  check("fee zero case (0 -> 0)", app.computeFeeWei(0n) === 0n);
  check("fee accepts string wei", app.computeFeeWei("1000") === 50n);
  const previewSum = [374n * E18, 748n * E18].reduce((a, b) => a + b, 0n);
  check("fee from summed previews (374+748 -> 56.1)", app.computeFeeWei(previewSum) === 561n * E18 / 10n,
    app.formatCAT(app.computeFeeWei(previewSum)));

  // 6) ZAP burn transfer calldata round-trip (the only fee transaction)
  const tr = app.encodeTransfer(app.BURN_ADDRESS, 6789n);
  const trw = wordsOf(tr);
  check("transfer selector", tr.slice(0, 10) === "0xa9059cbb", tr.slice(0, 10));
  check("transfer goes to burn address", wordAddr(trw[0]) === app.BURN_ADDRESS.toLowerCase(), wordAddr(trw[0]));
  check("transfer amount", wordUint(trw[1]) === 6789n);
  const feeTr = app.encodeTransfer(app.BURN_ADDRESS, 48300000000000000n); // ≈0.0483 ZAP
  const ftw = wordsOf(feeTr);
  check("fee-sized transfer amount round-trips", wordUint(ftw[1]) === 48300000000000000n && wordAddr(ftw[0]) === app.BURN_ADDRESS.toLowerCase());

  const gq = app.encodeGetAmountsOut(1000n, [app.CAT42, app.ZAP]);
  const gqw = wordsOf(gq);
  check("getAmountsOut selector", gq.slice(0, 10) === "0xd06ca61f", gq.slice(0, 10));
  check("getAmountsOut amountIn", wordUint(gqw[0]) === 1000n);
  check("getAmountsOut path offset", wordUint(gqw[1]) === 64n);
  check("getAmountsOut path", wordUint(gqw[2]) === 2n && wordAddr(gqw[3]) === app.CAT42.toLowerCase() && wordAddr(gqw[4]) === app.ZAP.toLowerCase());

  // 7) live router quote + fee sizing: a 400 CAT42 estimate -> fee 20 CAT42 -> ~0.0483 ZAP
  const quote = await app.quoteZapOut(400n * E18);
  console.log("live quote 400 CAT42 -> ZAP:", quote === null ? "null" : `${Number(quote) / 1e18} ZAP`);
  check("live quote readable", quote !== null && quote > 0n);
  check("live quote sane range", quote !== null && quote > E18 / 10n && quote < 5n * E18, quote === null ? "null" : String(Number(quote) / 1e18));
  const feeQuote = await app.quoteZapOut(app.computeFeeWei(400n * E18));
  console.log("live fee quote 20 CAT42 -> ZAP:", feeQuote === null ? "null" : `${Number(feeQuote) / 1e18} ZAP`);
  check("fee quote readable", feeQuote !== null && feeQuote > 0n);
  check("fee quote sane range (~0.0483)", feeQuote !== null && feeQuote > E18 / 200n && feeQuote < E18 / 4n,
    feeQuote === null ? "null" : String(Number(feeQuote) / 1e18));

  // 8) id-set fingerprint + honored intersection (resume, never double-charge)
  check("fingerprint order-insensitive", app.idsFingerprint([3, 1, 2]) === app.idsFingerprint([2, 3, 1]));
  check("fingerprint differs by set", app.idsFingerprint([1, 2]) !== app.idsFingerprint([1, 3]));
  check("fingerprint of empty set stable", app.idsFingerprint([]) === app.idsFingerprint([]));
  check("honored = intersection", JSON.stringify(app.honoredClaimIds([1, 2, 3], [2, 3, 4])) === JSON.stringify([2, 3]));
  check("honored empty when disjoint", app.honoredClaimIds([1, 2], [3, 4]).length === 0);
  check("honored keeps unclaimed order", JSON.stringify(app.honoredClaimIds([9, 5], [5, 7, 9])) === JSON.stringify([5, 9]));

  // 9) claim-gate state logic: no claim path without a verified burn (or a zero fee)
  const gate = (o) => app.computeClaimAccess(o);
  let g = gate({ unclaimedIds: [], feeCatWei: 10n, feeZapWei: 5n, zapBalanceWei: 5n, paidIds: null });
  check("gate: nothing to claim", g.status === "nothing" && g.claimIds.length === 0);
  g = gate({ unclaimedIds: [1, 2], feeCatWei: 0n, feeZapWei: null, zapBalanceWei: null, paidIds: null });
  check("gate: zero fee unlocks all", g.status === "unlocked" && g.claimIds.length === 2);
  g = gate({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: 5n, zapBalanceWei: 100n, paidIds: null });
  check("gate: payable but NOT unlocked (locked until burn)", g.status === "ready" && g.claimIds.length === 0);
  g = gate({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: null, zapBalanceWei: 100n, paidIds: null });
  check("gate: no quote -> needquote, locked", g.status === "needquote" && g.claimIds.length === 0);
  g = gate({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: 50n, zapBalanceWei: 30n, paidIds: null });
  check("gate: short balance -> insufficient", g.status === "insufficient" && g.claimIds.length === 0);
  check("gate: shortfall is exact", g.shortfallWei === "20");
  g = gate({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: 50n, zapBalanceWei: null, paidIds: null });
  check("gate: unreadable balance -> insufficient, shortfall unknown", g.status === "insufficient" && g.shortfallWei === null);
  g = gate({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: null, zapBalanceWei: null, paidIds: [1, 2] });
  check("gate: paid record unlocks without quote/balance (no double charge)", g.status === "unlocked" && g.claimIds.length === 2 && g.honored === true);
  g = gate({ unclaimedIds: [2, 3, 4], feeCatWei: 10n, feeZapWei: null, zapBalanceWei: null, paidIds: [1, 2, 3] });
  check("gate: paid record honored for remaining ids only", g.status === "unlocked" && JSON.stringify(g.claimIds) === JSON.stringify([2, 3]) && g.extra === 1);
  g = gate({ unclaimedIds: [7, 8], feeCatWei: 10n, feeZapWei: 50n, zapBalanceWei: 60n, paidIds: [1, 2] });
  check("gate: disjoint paid record does not unlock a new set", g.status === "ready" && g.claimIds.length === 0);

  // 10) burn verification from a receipt: exact ZAP user -> burn-address log only
  const USER = "0x2222222222222222222222222222222222222222";
  const topic = (a) => "0x" + "0".repeat(24) + a.slice(2).toLowerCase();
  const burnLog = (amt) => ({ address: app.ZAP, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", topic(USER), topic(app.BURN_ADDRESS)], data: "0x" + amt.toString(16).padStart(64, "0") });
  check("burn verified: exact log", app.receiptBurnVerified({ status: "0x1", logs: [burnLog(500n)] }, USER, 500n) === true);
  check("burn verified: string amount", app.receiptBurnVerified({ status: "0x1", logs: [burnLog(500n)] }, USER, "500") === true);
  check("burn not verified: wrong amount", app.receiptBurnVerified({ status: "0x1", logs: [burnLog(499n)] }, USER, 500n) === false);
  check("burn not verified: failed tx", app.receiptBurnVerified({ status: "0x0", logs: [burnLog(500n)] }, USER, 500n) === false);
  check("burn not verified: recipient not burn address",
    app.receiptBurnVerified({ status: "0x1", logs: [{ address: app.ZAP, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", topic(USER), topic("0x3333333333333333333333333333333333333333")], data: "0x" + (500n).toString(16).padStart(64, "0") }] }, USER, 500n) === false);
  check("burn not verified: no logs", app.receiptBurnVerified({ status: "0x1", logs: [] }, USER, 500n) === false);
  check("burn not verified: null receipt", app.receiptBurnVerified(null, USER, 500n) === false);

  // 11) both HTML shells carry the fee UI + strings; the swap route is gone
  const appJs = fs.readFileSync(path.join(__dirname, "..", "docs", "app.js"), "utf8");
  for (const shell of ["en.html", "ja.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", shell), "utf8");
    for (const id of ["feeBox", "feeTitle", "feeNote", "feeEstimate", "feePanel", "feePendingTitle", "feePendingText", "feeResumeBtn", "feeProgress", "feeResult"]) {
      check(`${shell} has #${id}`, html.includes(`id="${id}"`));
    }
    check(`${shell} loads app.js?v=4`, html.includes("app.js?v=4"));
  }
  check("swap route removed from app.js", !appJs.includes("swapExactTokensForTokens") && !appJs.includes("encodeApprove"));
  check("claim path gated on unlocked access", appJs.includes('state.access.status !== "unlocked"'));
  check("i18n en feeNote: prepaid wording", appJs.includes("paid before you claim"));
  check("i18n en feeNote: no-refund disclosure", appJs.includes("cannot be refunded"));
  check("i18n en feeNote: estimate disclosure", appJs.includes("figured from the estimated amounts"));
  check("i18n ja feeNote: prepaid wording", appJs.includes("手数料を請求の前にいただいています"));
  check("i18n ja feeNote: no-refund disclosure", appJs.includes("戻ってきません"));
  check("i18n ja feeNote: estimate disclosure", appJs.includes("手数料は見込み額から計算します"));

  // 12) ZAP faucet: decimal parsing (the Worker formats amounts as plain
  // decimal strings in token units)
  check("decimal '1' -> 1e18 wei", app.parseDecimalToWei("1") === E18);
  check("decimal '0.5' -> 5e17 wei", app.parseDecimalToWei("0.5") === 5n * 10n ** 17n);
  check("decimal '12.340' exact", app.parseDecimalToWei("12.340") === 1234n * 10n ** 16n);
  check("decimal '0' -> 0", app.parseDecimalToWei("0") === 0n);
  check("decimal junk -> null", app.parseDecimalToWei("1.2.3") === null && app.parseDecimalToWei("abc") === null && app.parseDecimalToWei("") === null);
  check("decimal >18 places -> null", app.parseDecimalToWei("0.0000000000000000001") === null);
  check("decimal non-string -> null", app.parseDecimalToWei(1) === null && app.parseDecimalToWei(null) === null);
  check("formatZap trims zeros", app.formatZap(E18) === "1" && app.formatZap(15n * 10n ** 17n) === "1.5" && app.formatZap(0n) === "0");

  // 13) ZAP faucet: /status parsing (shape from the live Worker contract)
  const st = app.parseZapFaucetStatus({ ready: true, reason: null, faucetAddress: "0xabc", balance: "6.5", claimsLeft: 6, chain: "42", token: "zap", symbol: "ZAP", claimAmount: "1" });
  check("status parsed", !!st && st.ready === true && st.symbol === "ZAP");
  check("status balance -> wei string", st && st.balanceWei === (65n * 10n ** 17n).toString(), st && st.balanceWei);
  check("status claimsLeft kept", st && st.claimsLeft === 6);
  check("status claimAmount -> wei string", st && st.claimAmountWei === E18.toString());
  check("status not-ready keeps reason", (() => { const s2 = app.parseZapFaucetStatus({ ready: false, reason: "faucet_low", balance: "0", claimsLeft: 0, claimAmount: "1" }); return !!s2 && s2.ready === false && s2.reason === "faucet_low"; })());
  check("status missing claimAmount -> null", app.parseZapFaucetStatus({ ready: true, balance: "1" }) === null);
  check("status null/garbage -> null", app.parseZapFaucetStatus(null) === null && app.parseZapFaucetStatus("x") === null);

  // 14) ZAP faucet: LIVE read-only /status (no claim is ever POSTed here)
  const live = await app.fetchZapFaucetStatus();
  console.log("live ZAP faucet status:", JSON.stringify(live));
  check("live faucet status readable", live !== null);
  check("live faucet claim amount is 1 ZAP", live && live.claimAmountWei === E18.toString(), live && live.claimAmountWei);
  check("live faucet claimsLeft is a number", live && typeof live.claimsLeft === "number" && live.claimsLeft >= 0, live && String(live.claimsLeft));
  check("live faucet balance parses", live && live.balanceWei !== null && BigInt(live.balanceWei) >= 0n);

  // 15) ZAP faucet: claim request shape + response parsing (stubbed fetch)
  const ADDR = "0x1111111111111111111111111111111111111111";
  check("claim body shape", JSON.stringify(app.buildZapClaimBody(ADDR)) === JSON.stringify({ chain: "42", token: "zap", address: ADDR }));
  let seenReq = null;
  const stubOk = async (url, init) => { seenReq = { url, init }; return { ok: true, status: 200, json: async () => ({ ok: true, txHash: "0xdeadbeef", amount: "1", explorerUrl: "https://scan.infinitedrive.xyz/tx/0xdeadbeef", chain: "42", token: "zap", symbol: "ZAP" }) }; };
  const cres = await app.claimZapFaucet(ADDR, stubOk);
  check("claim success parsed", cres.ok === true && cres.txHash === "0xdeadbeef" && cres.amount === "1" && cres.explorerUrl.endsWith("0xdeadbeef"));
  check("claim POSTs to /claim", !!seenReq && seenReq.url === app.FAUCET_BASE + "/claim" && seenReq.init.method === "POST");
  check("claim POST body is the claim shape", !!seenReq && seenReq.init.body === JSON.stringify({ chain: "42", token: "zap", address: ADDR }), seenReq && seenReq.init.body);
  check("claim POST content-type json", !!seenReq && seenReq.init.headers["content-type"] === "application/json");

  // 16) ZAP faucet: EVERY Worker rejection code maps to its own message
  for (const code of app.FAUCET_ERR_CODES) {
    const stubErr = async () => ({ ok: false, status: 429, json: async () => ({ ok: false, code, retryAfterSec: 3600 }) });
    const er = await app.claimZapFaucet(ADDR, stubErr);
    check(`claim error code kept: ${code}`, er.ok === false && er.code === code);
    check(`error key distinct: ${code}`, app.faucetErrorKey(code) === "faucetErr_" + code);
    check(`i18n has faucetErr_${code} in EN and JA`, appJs.split("faucetErr_" + code).length - 1 >= 2);
  }
  check("error key: unknown code -> failed", app.faucetErrorKey("something_new") === "faucetErr_failed");
  check("error key: network distinct", app.faucetErrorKey("network") === "faucetErrNetwork");
  check("i18n has faucetErrNetwork in EN and JA", appJs.split("faucetErrNetwork").length - 1 >= 2);
  const stubThrow = async () => { throw new Error("offline"); };
  const nres = await app.claimZapFaucet(ADDR, stubThrow);
  check("claim fetch failure -> network code", nres.ok === false && nres.code === "network");
  check("claim response: ok without fields still parses", (() => { const r = app.parseZapClaimResponse({ ok: true }); return r.ok === true && r.txHash === "" && r.explorerUrl === null; })());
  check("claim response: no code -> failed", app.parseZapClaimResponse({ ok: false }).code === "failed" && app.parseZapClaimResponse(null).code === "failed");
  check("cooldown codes detected", app.isCooldownCode("address_cooldown") && app.isCooldownCode("ip_cooldown") && !app.isCooldownCode("daily_limit"));
  check("retryParts: 7d -> days", JSON.stringify(app.retryParts(7 * 86400)) === JSON.stringify({ unit: "days", n: 7 }));
  check("retryParts: 2h -> hours", JSON.stringify(app.retryParts(7200)) === JSON.stringify({ unit: "hours", n: 2 }));
  check("retryParts: 5m -> minutes", JSON.stringify(app.retryParts(300)) === JSON.stringify({ unit: "minutes", n: 5 }));

  // 17) fee-gate re-evaluation after a faucet claim lands (balance + claimed)
  let fg = app.gateAfterFaucetClaim({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: 50n, zapBalanceWei: 30n, claimedWei: 20n, paidIds: null });
  check("faucet re-eval: covered -> ready (burn offered)", fg.status === "ready" && fg.claimIds.length === 0);
  fg = app.gateAfterFaucetClaim({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: 50n, zapBalanceWei: 30n, claimedWei: 10n, paidIds: null });
  check("faucet re-eval: still short, exact new shortfall", fg.status === "insufficient" && fg.shortfallWei === "10", fg.shortfallWei);
  fg = app.gateAfterFaucetClaim({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: 50n, zapBalanceWei: null, claimedWei: 10n, paidIds: null });
  check("faucet re-eval: unknown balance stays unknown", fg.status === "insufficient" && fg.shortfallWei === null);
  fg = app.gateAfterFaucetClaim({ unclaimedIds: [1, 2], feeCatWei: 10n, feeZapWei: null, zapBalanceWei: 0n, claimedWei: 10n, paidIds: [1, 2] });
  check("faucet re-eval: paid record still honored", fg.status === "unlocked" && fg.claimIds.length === 2);

  // 18) both shells carry the faucet card + the in-fee-panel claim button
  for (const shell of ["en.html", "ja.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", shell), "utf8");
    for (const id of ["faucetPanel", "faucetTitle", "faucetIntro", "faucetPoolLabel", "faucetPoolLine", "faucetClaimBtn", "faucetRefreshBtn", "faucetProgress", "faucetResult", "feeFaucetBtn"]) {
      check(`${shell} has #${id}`, html.includes(`id="${id}"`));
    }
  }
  check("app.js talks to the faucet Worker", appJs.includes("https://42-faucet.nepicobsv.workers.dev"));
  check("shortfall no longer links out to the faucet site", !appJs.includes("github.io/42-faucet"));

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });

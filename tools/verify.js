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
    check(`${shell} loads app.js?v=3`, html.includes("app.js?v=3"));
  }
  check("swap route removed from app.js", !appJs.includes("swapExactTokensForTokens") && !appJs.includes("encodeApprove"));
  check("claim path gated on unlocked access", appJs.includes('state.access.status !== "unlocked"'));
  check("i18n en feeNote: prepaid wording", appJs.includes("paid before you claim"));
  check("i18n en feeNote: no-refund disclosure", appJs.includes("cannot be refunded"));
  check("i18n en feeNote: estimate disclosure", appJs.includes("figured from the estimated amounts"));
  check("i18n ja feeNote: prepaid wording", appJs.includes("手数料を請求の前にいただいています"));
  check("i18n ja feeNote: no-refund disclosure", appJs.includes("戻ってきません"));
  check("i18n ja feeNote: estimate disclosure", appJs.includes("手数料は見込み額から計算します"));

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });

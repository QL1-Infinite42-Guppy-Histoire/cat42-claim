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

  // 5) site fee math: 5% of received, rounded down, zero case skips the phase
  const E18 = 10n ** 18n;
  check("fee 5% of 374 CAT42", app.computeFeeWei(374n * E18) === 187n * E18 / 10n, app.formatCAT(app.computeFeeWei(374n * E18)));
  check("fee floor (101 wei -> 5)", app.computeFeeWei(101n) === 5n, String(app.computeFeeWei(101n)));
  check("fee zero case (19 wei -> 0)", app.computeFeeWei(19n) === 0n);
  check("fee zero case (0 -> 0)", app.computeFeeWei(0n) === 0n);
  check("fee accepts string wei", app.computeFeeWei("1000") === 50n);

  // 6) fee calldata round-trips
  const ap = app.encodeApprove(app.ROUTER, 12345n);
  const apw = wordsOf(ap);
  check("approve selector", ap.slice(0, 10) === "0x095ea7b3", ap.slice(0, 10));
  check("approve spender", wordAddr(apw[0]) === app.ROUTER.toLowerCase(), wordAddr(apw[0]));
  check("approve amount", wordUint(apw[1]) === 12345n);

  const tr = app.encodeTransfer(app.BURN_ADDRESS, 6789n);
  const trw = wordsOf(tr);
  check("transfer selector", tr.slice(0, 10) === "0xa9059cbb", tr.slice(0, 10));
  check("transfer goes to burn address", wordAddr(trw[0]) === app.BURN_ADDRESS.toLowerCase(), wordAddr(trw[0]));
  check("transfer amount", wordUint(trw[1]) === 6789n);

  const sw = app.encodeSwapExactTokensForTokens(1000n, 900n, [app.CAT42, app.ZAP], "0x1111111111111111111111111111111111111111", 1700000600n);
  const sww = wordsOf(sw);
  check("swap selector", sw.slice(0, 10) === "0x38ed1739", sw.slice(0, 10));
  check("swap amountIn", wordUint(sww[0]) === 1000n);
  check("swap amountOutMin", wordUint(sww[1]) === 900n);
  check("swap path offset", wordUint(sww[2]) === 160n, String(wordUint(sww[2])));
  check("swap to", wordAddr(sww[3]) === "0x1111111111111111111111111111111111111111");
  check("swap deadline", wordUint(sww[4]) === 1700000600n);
  check("swap path length", wordUint(sww[5]) === 2n);
  check("swap path[0] = CAT42", wordAddr(sww[6]) === app.CAT42.toLowerCase());
  check("swap path[1] = ZAP", wordAddr(sww[7]) === app.ZAP.toLowerCase());

  const gq = app.encodeGetAmountsOut(1000n, [app.CAT42, app.ZAP]);
  const gqw = wordsOf(gq);
  check("getAmountsOut selector", gq.slice(0, 10) === "0xd06ca61f", gq.slice(0, 10));
  check("getAmountsOut amountIn", wordUint(gqw[0]) === 1000n);
  check("getAmountsOut path offset", wordUint(gqw[1]) === 64n);
  check("getAmountsOut path", wordUint(gqw[2]) === 2n && wordAddr(gqw[3]) === app.CAT42.toLowerCase() && wordAddr(gqw[4]) === app.ZAP.toLowerCase());

  // 7) live router quote: 400 CAT42 should buy a sane amount of ZAP
  //    (reference rate ≈ 0.00241 ZAP/CAT42 → ≈0.96 ZAP; accept 0.1..5 for drift)
  const quote = await app.quoteZapOut(400n * E18);
  console.log("live quote 400 CAT42 -> ZAP:", quote === null ? "null" : `${Number(quote) / 1e18} ZAP`);
  check("live quote readable", quote !== null && quote > 0n);
  check("live quote sane range", quote !== null && quote > E18 / 10n && quote < 5n * E18, quote === null ? "null" : String(Number(quote) / 1e18));

  // receipt-log fallback parser: sum ZAP transfers to the user
  const fakeReceipt = { logs: [
    { address: app.ZAP, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x" + "0".repeat(24) + app.ROUTER.slice(2).toLowerCase(),
      "0x" + "0".repeat(24) + "2222222222222222222222222222222222222222"], data: "0x" + (500n).toString(16).padStart(64, "0") },
    { address: app.CAT42, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
      "0x" + "0".repeat(24) + app.ROUTER.slice(2).toLowerCase(),
      "0x" + "0".repeat(24) + "2222222222222222222222222222222222222222"], data: "0x" + (999n).toString(16).padStart(64, "0") }
  ] };
  check("zapReceivedFromLogs sums only ZAP to user",
    app.zapReceivedFromLogs(fakeReceipt, "0x2222222222222222222222222222222222222222") === 500n);
  check("zapReceivedFromLogs null when no match",
    app.zapReceivedFromLogs(fakeReceipt, "0x3333333333333333333333333333333333333333") === null);

  // 8) both HTML shells carry the fee UI + strings, and app.js?v=2 is used
  const appJs = fs.readFileSync(path.join(__dirname, "..", "docs", "app.js"), "utf8");
  for (const shell of ["en.html", "ja.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "docs", shell), "utf8");
    for (const id of ["feeBox", "feeTitle", "feeNote", "feeEstimate", "feePanel", "feePendingTitle", "feePendingText", "feeResumeBtn", "feeProgress", "feeResult"]) {
      check(`${shell} has #${id}`, html.includes(`id="${id}"`));
    }
    check(`${shell} loads app.js?v=2`, html.includes("app.js?v=2"));
  }
  check("i18n en feeNote mentions 5% and ZAP", appJs.includes("5% is swapped into a token called ZAP"));
  check("i18n ja feeNote mentions 5% and ZAP", appJs.includes("5% を ZAP というトークンに交換し"));
  check("i18n en fee done line present", appJs.includes("was swapped into {zap} ZAP, and all of that ZAP was burned"));
  check("i18n ja fee done line present", appJs.includes("ZAP をすべてバーンしました"));

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });

"use strict";
/* Headless verification harness — requires the SAME functions as docs/app.js.
   Run: node tools/verify.js
   The site fee (prepaid ZAP burn) and the in-page ZAP faucet were abolished
   on 2026-11-14; this harness asserts they are GONE, and keeps the live
   read-only scan checks (no transaction is ever sent). */
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
    check(`${name} loads app.js?v=4`, html.includes("app.js?v=4"));
    check(`${name} mentions no faucet/fee markup`, !/faucet|feePanel|feeBox/.test(html));
  }
  const enIds = [...idsOf(enHtml)].sort();
  const jaIds = [...idsOf(jaHtml)].sort();
  check("en.html / ja.html element-id sets identical", JSON.stringify(enIds) === JSON.stringify(jaIds), `${enIds.length} ids`);
  const jsIds = new Set([...appJs.matchAll(/\$\("([A-Za-z]+)"\)/g)].map(m => m[1]));
  const missing = [...jsIds].filter(id => !idsOf(enHtml).has(id));
  check("every id app.js uses exists in the shells", missing.length === 0, missing.join(","));

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });

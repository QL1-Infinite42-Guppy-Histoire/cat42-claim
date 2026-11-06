"use strict";
/* Headless verification harness — requires the SAME functions as docs/app.js.
   Run: node tools/verify.js */
const app = require("../docs/app.js");

function decodeClaimMany(data) {
  const sel = data.slice(0, 10);
  const body = data.slice(10);
  const words = [];
  for (let i = 0; i + 64 <= body.length; i += 64) words.push(BigInt("0x" + body.slice(i, i + 64)));
  return { selector: sel, offset: words[0], length: Number(words[1]), ids: words.slice(2).map(Number) };
}

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

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });

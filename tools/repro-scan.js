/* Reproduction harness for the 735-vs-736 scan mismatch (2026-11-14).
   Ground truth: one HTTP POST per eth_call (NO JSON-RPC batching), retried.
   Site: the real scanOwnedGuides from docs/app.js, run as-is. */
const app = require("../docs/app.js");
const OWNER = "0x0E2E4b54A1E2FF313B91EA2f5Bca3B6152a592B0";
const GUIDE = app.GUIDE, CAT42 = app.CAT42, SEL = app.SEL;
const RPCS = app.RPCS;

async function singleCall(rpc, to, data, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      });
      const j = await res.json();
      if (j && typeof j.result === "string") return j.result;
      if (j && j.error) return "ERROR:" + (j.error.message || "rpc error");
    } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 250 * (t + 1)));
  }
  return null;
}

async function groundTruth() {
  const rpc = RPCS[0];
  const nextIdHex = await singleCall(rpc, GUIDE, SEL.nextId);
  const total = Number(BigInt(nextIdHex)) - 1;
  const balHex = await singleCall(rpc, GUIDE, app.SEL.balanceOf + app.encodeAddress(OWNER));
  const balanceOf = Number(BigInt(balHex));
  console.log(`[truth] nextId-1=${total} balanceOf=${balanceOf}`);
  const owned = [];
  const errors = [];
  const queue = [];
  for (let id = 1; id <= total; id++) queue.push(id);
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const id = queue[idx++];
      const data = SEL.ownerOf + app.encodeUint(id);
      const r = await singleCall(rpc, GUIDE, data);
      if (r && r.startsWith("ERROR:")) { errors.push(id); continue; }
      if (!r) { errors.push(id); continue; }
      const a = app.decodeAddress(r);
      if (a === OWNER.toLowerCase()) owned.push(id);
    }
  }
  await Promise.all(Array.from({ length: 20 }, worker));
  owned.sort((a, b) => a - b);
  console.log(`[truth] owned=${owned.length} erroredIds=${JSON.stringify(errors)}`);
  return { total, balanceOf, owned };
}

async function siteScan(run) {
  const s = await app.scanOwnedGuides(OWNER, { onProgress: () => {} });
  console.log(`[site #${run}] owned=${s.ownedIds.length} balanceOf=${s.balanceOfCount} mismatch=${s.mismatch} claimed=${s.claimedIds.length} unclaimed=${s.unclaimed.length} totalPreview=${app.formatCAT(BigInt(s.totalPreviewWei))}`);
  return s;
}

(async () => {
  const truth = await groundTruth();
  const truthSet = new Set(truth.owned);
  for (let run = 1; run <= 3; run++) {
    const s = await siteScan(run);
    const siteSet = new Set(s.ownedIds);
    const missing = truth.owned.filter(id => !siteSet.has(id));
    const extra = s.ownedIds.filter(id => !truthSet.has(id));
    console.log(`[site #${run}] missingVsTruth=${JSON.stringify(missing)} extraVsTruth=${JSON.stringify(extra)}`);
    if (missing.length) {
      for (const id of missing) {
        const c = await singleCall(RPCS[0], CAT42, SEL.claimed + app.encodeUint(id));
        const p = await singleCall(RPCS[0], CAT42, SEL.preview + app.encodeUint(id));
        const t = await singleCall(RPCS[0], GUIDE, SEL.tier + app.encodeUint(id));
        console.log(`  missing Guide #${id}: claimed=${c ? String(BigInt(c) !== 0n) : "?"} previewWei=${p ? String(BigInt(p)) : "?"} preview=${p ? app.formatCAT(BigInt(p)) : "?"} tier=${t ? String(Number(BigInt(t))) : "?"}`);
      }
    }
  }
  // Also report truth-side claim status for ALL truth-owned ids not in site's claimed set is done per-run.
  console.log("[done]");
})().catch(e => { console.error("FATAL", e); process.exit(1); });

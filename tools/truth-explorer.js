/* Independent ground truth from the Blockscout index (not RPC batch):
   list every Guide token instance the explorer credits to the address,
   then diff against the site's own scan result (run in-process). */
const app = require("../docs/app.js");
const OWNER = "0x0E2E4b54A1E2FF313B91EA2f5Bca3B6152a592B0";
const GUIDE_LC = app.GUIDE.toLowerCase();
const BASE = "https://scan.infinitedrive.xyz/api/v2/addresses/" + OWNER + "/nft";

async function fetchPage(params) {
  const qs = new URLSearchParams(params).toString();
  const url = BASE + "?type=ERC-721" + (qs ? "&" + qs.replace(/^type=ERC-721&?/, "") : "");
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
  return res.json();
}

(async () => {
  const ids = [];
  let params = {};
  let pages = 0;
  while (true) {
    const j = await fetchPage(params);
    pages++;
    for (const it of (j.items || [])) {
      const th = (it.token && it.token.address_hash || "").toLowerCase();
      if (th === GUIDE_LC) ids.push(Number(it.id));
    }
    if (!j.next_page_params) break;
    params = j.next_page_params;
    if (pages > 40) throw new Error("too many pages");
  }
  ids.sort((a, b) => a - b);
  console.log(`[explorer] pages=${pages} guideIds=${ids.length}`);
  require("fs").writeFileSync("/tmp/explorer-ids.json", JSON.stringify(ids));

  const s = await app.scanOwnedGuides(OWNER, { onProgress: () => {} });
  console.log(`[site] owned=${s.ownedIds.length} balanceOf=${s.balanceOfCount} claimed=${s.claimedIds.length} unclaimed=${s.unclaimed.length}`);
  const siteSet = new Set(s.ownedIds);
  const exSet = new Set(ids);
  const missingInSite = ids.filter(id => !siteSet.has(id));
  const extraInSite = s.ownedIds.filter(id => !exSet.has(id));
  console.log("[diff] inExplorerNotSite=" + JSON.stringify(missingInSite));
  console.log("[diff] inSiteNotExplorer=" + JSON.stringify(extraInSite));
})().catch(e => { console.error("FATAL", e); process.exit(1); });

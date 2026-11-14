/* Focused probe: for suspect IDs, call ownerOf sequentially on BOTH RPCs
   and log the raw JSON-RPC response. Also claimed/preview/tier for each. */
const app = require("../docs/app.js");
const OWNER = "0x0E2E4b54A1E2FF313B91EA2f5Bca3B6152a592B0".toLowerCase();
const GUIDE = app.GUIDE, CAT42 = app.CAT42, SEL = app.SEL;
const IDS = [418, 1556, 2058, 2305, 2612, 2723, 2724, 3574, 3581, 3627, 3908, 4426, 5050, 5136, 5137, 5140, 5142];

async function raw(rpc, to, data) {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
    });
    const j = await res.json();
    return j;
  } catch (e) {
    return { fetchError: String(e && e.message || e) };
  }
}

(async () => {
  for (const rpc of app.RPCS) {
    console.log("=== RPC", rpc);
    for (const id of IDS) {
      const j = await raw(rpc, GUIDE, SEL.ownerOf + app.encodeUint(id));
      let out;
      if (j && typeof j.result === "string") {
        const a = app.decodeAddress(j.result);
        out = "owner=" + a + (a === OWNER ? "  <<< USER OWNS" : "");
      } else {
        out = "RESP " + JSON.stringify(j).slice(0, 220);
      }
      console.log(`#${id} ownerOf: ${out}`);
      await new Promise(r => setTimeout(r, 120));
    }
  }
  console.log("=== claim state for any ID the user owns (from either RPC above, check manually) + full errored set on RPC1");
  for (const id of IDS) {
    const c = await raw(app.RPCS[0], CAT42, SEL.claimed + app.encodeUint(id));
    const p = await raw(app.RPCS[0], CAT42, SEL.preview + app.encodeUint(id));
    const cs = c && typeof c.result === "string" ? String(BigInt(c.result) !== 0n) : JSON.stringify(c).slice(0, 120);
    const ps = p && typeof p.result === "string" ? app.formatCAT(BigInt(p.result)) : JSON.stringify(p).slice(0, 120);
    console.log(`#${id} claimed=${cs} preview=${ps}`);
    await new Promise(r => setTimeout(r, 120));
  }
})();

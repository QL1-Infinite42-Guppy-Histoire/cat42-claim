"use strict";
/* CAT42 Claim — vanilla JS only. No web3 library.
   Pure helpers + scan logic are exported for the Node verification harness
   (see tools/verify.js) when run outside a browser. */

var CAT42 = "0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310";
var GUIDE = "0xF349E469C474048DEd6F9b914309E76880ED1bbD";
var CHAIN_ID_HEX = "0x66c9a"; // 421018
var RPCS = [
  "https://evm-rpc.infinitepanda.xyz",
  "https://evm-rpc-infinite.mschihuahua.org"
];
var EXPLORER = "https://scan.infinitedrive.xyz";
var TOKEN_ICON = "https://raw.githubusercontent.com/maze369/token-icons/main/icons/0x7386719ebbbeb4d810ff89027bfb8a1cdf696310.jpg";

var SEL = {
  claim: "0x379607f5",
  claimMany: "0x925489a8",
  claimed: "0xdbe7e3bd",
  preview: "0xc317c377",
  claims: "0xdcc59b6f",
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
  ignited: "0x66092ea8",
  ownerOf: "0x6352211e",
  nextId: "0x61b8ce8c",
  tier: "0x6dda34db"
};

var TIER_MUL = [1, 2, 4, 8];

/* ---------- i18n ---------- */
var I18N = {
  en: {
    pageTitle: "CAT42 Claim 🐱",
    pageSub: "If you have a Guide, you may have CAT42 waiting for you",
    howTitle: "How it works — 3 easy steps",
    step1: "Connect your wallet (the one that holds your Guide)",
    step2: "We find your Guides and check what you can claim",
    step3: "Tap once to claim everything",
    howNote: "Each Guide can claim CAT42 once. The amount depends on the Guide's kind (see the list after you connect). You only pay a small network fee (in [42]) when you claim.",
    statsTitle: "Right now, for everyone",
    statClaimsLabel: "Claims so far",
    statVaultLabel: "CAT42 left to share",
    statGuidesLabel: "Guides issued",
    statsNote: "These numbers are read live from the chain, so they are always up to date.",
    statsError: "Could not load the latest numbers. Please reload the page in a little while.",
    noWalletTitle: "You need a wallet app",
    noWalletText: "No wallet was found in this browser. Please install a wallet app such as MetaMask, then open this page inside that app's browser. Never share your recovery phrase or private key with anyone — this site will never ask for it.",
    connectBtn: "Connect wallet",
    connectNote: "Tap to connect. We only read your public address — we cannot move your money by connecting.",
    yourWalletLabel: "Your wallet",
    rescanBtn: "Check again",
    switchChainBtn: "Switch to 42 Chain",
    totalLabel: "CAT42 you can claim (estimate)",
    totalNote: "This is the amount if you claim right now. When you claim for many Guides at once, each next Guide pays a little less than the one before, and the shared pool also gets a little smaller every day — so the final amount may be a bit less than shown.",
    ownedLabel: "Guides you have",
    unclaimedLabel: "Not claimed yet",
    claimedLabel: "Already claimed",
    claimBtn: "Claim all",
    claimBtnNone: "Nothing to claim",
    unclaimedTitle: "Guides you can claim for",
    claimedSummary: "Already claimed Guides",
    emptyList: "There is nothing left to claim. You have claimed for all your Guides — nice work!",
    noGuides: "No Guides were found in this wallet. If you have a Guide in another wallet, please connect that wallet.",
    safeTitle: "Please keep this safe",
    safe1: "Never enter your recovery phrase or private key anywhere. This site never asks for it.",
    safe2: "Claiming needs a small amount of [42] in your wallet to pay the network fee.",
    safe3: "Each Guide can claim only once. Claimed Guides cannot claim again.",
    contractLine: "CAT42: 0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310 · Guide: 0xF349E469C474048DEd6F9b914309E76880ED1bbD · Chain: 42 Chain (421018)",
    footerText: "For 42 Chain (EVM chain ID 421018). CAT42 amounts shown are estimates read from the chain at that moment. Not affiliated with the chain operators.",
    tiers: ["Common", "Rare", "Epic", "Legendary"],
    tierUnknown: "Kind unknown",
    guideLabel: "Guide #{id}",
    expected: "About {amount} CAT42",
    yourCat: "Your CAT42 now: {amount} CAT42",
    searching: "Looking for your Guides… {done} / {total}",
    checkingClaims: "Checking which Guides you have already claimed for…",
    mismatch: "Note: we found {found} Guides by scanning, but your wallet reports {expected}. The {expected} number is the one to trust — please tap “Check again”. If it still differs, the list below may be incomplete.",
    connected: "Connected. Looking for your Guides…",
    rejected: "You cancelled in your wallet. Nothing happened — tap Connect when you are ready.",
    wrongChain: "Your wallet is on a different network. Please switch to 42 Chain.",
    switchOk: "Switched to 42 Chain.",
    scanFailed: "We could not read the chain. Please check your connection and tap “Check again”.",
    claimingStep: "Claiming… step {cur} of {total}. Please confirm in your wallet.",
    waitingTx: "Waiting for the network to finish… step {cur} of {total}",
    claimDone: "Done! You received {amount} CAT42.",
    claimDoneNoDiff: "Done! Your claim went through.",
    txLink: "See the record",
    txFailed: "The claim did not go through. No CAT42 was claimed. You can try again.",
    nothingToClaim: "There is nothing to claim right now.",
  },
  ja: {
    pageTitle: "CAT42 請求 🐱",
    pageSub: "ガイドを持っていると、CAT42 がもらえるかもしれません",
    howTitle: "使い方はかんたん 3ステップ",
    step1: "ウォレットをつなぐ（ガイドが入っているウォレット）",
    step2: "あなたのガイドを探して、もらえる量を調べます",
    step3: "ボタンを1回押して全部受け取る",
    howNote: "ガイド1つにつき、CAT42 を請求できるのは1回だけです。もらえる量はガイドの種類で変わります（つないだあとの一覧で見られます）。請求するときは、ネットワークの手数料として少しだけ [42] が必要です。",
    statsTitle: "いま全体では",
    statClaimsLabel: "これまでの請求回数",
    statVaultLabel: "残っている CAT42",
    statGuidesLabel: "発行されたガイド",
    statsNote: "この数字はチェーンから直接読んでいるので、いつも最新の状態です。",
    statsError: "最新の数字を読み込めませんでした。少し待ってからページを開き直してください。",
    noWalletTitle: "ウォレットアプリが必要です",
    noWalletText: "このブラウザではウォレットが見つかりませんでした。MetaMask などのウォレットアプリを入れて、そのアプリの中のブラウザでこのページを開いてください。復旧フレーズや秘密鍵は絶対に誰にも教えないでください — このサイトが聞くことはありません。",
    connectBtn: "ウォレットをつなぐ",
    connectNote: "押すとつながります。あなたの公開アドレスを読むだけです — つなぐだけでお金が動くことはありません。",
    yourWalletLabel: "あなたのウォレット",
    rescanBtn: "もう一度調べる",
    switchChainBtn: "42 Chain に切り替える",
    totalLabel: "未請求の CAT42（目安）",
    totalNote: "いま請求した場合の目安です。まとめて請求すると、ガイド1つごとに少しずつもらえる量が減ります。また、みんなで分け合うプールも毎日少しずつ減っていくので、実際にもらえる量は表示より少し少なくなることがあります。",
    ownedLabel: "持っているガイド",
    unclaimedLabel: "まだもらっていない",
    claimedLabel: "もらい済み",
    claimBtn: "まとめて全部もらう",
    claimBtnNone: "もらえるものはありません",
    unclaimedTitle: "請求できるガイド",
    claimedSummary: "もらい済みのガイド",
    emptyList: "もらえるものは残っていません。あなたのガイドは全部請求済みです！",
    noGuides: "このウォレットにガイドが見つかりませんでした。別のウォレットにガイドがある場合は、そのウォレットをつないでください。",
    safeTitle: "安全のためのお願い",
    safe1: "復旧フレーズや秘密鍵は、どこにも入力しないでください。このサイトが聞くことは決してありません。",
    safe2: "請求には、ネットワーク手数料としてウォレットに少し [42] が必要です。",
    safe3: "ガイド1つにつき請求は1回だけです。請求済みのガイドはもう請求できません。",
    contractLine: "CAT42: 0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310 · ガイド: 0xF349E469C474048DEd6F9b914309E76880ED1bbD · チェーン: 42 Chain (421018)",
    footerText: "42 Chain（EVM チェーンID 421018）向けです。表示される CAT42 の量は、その時点でチェーンから読んだ目安です。チェーン運営者とは関係ありません。",
    tiers: ["コモン", "レア", "エピック", "レジェンダリー"],
    tierUnknown: "種類不明",
    guideLabel: "ガイド #{id}",
    expected: "約 {amount} CAT42",
    yourCat: "いま持っている CAT42: {amount} CAT42",
    searching: "ガイドを探しています… {done} / {total}",
    checkingClaims: "請求済みかどうかを調べています…",
    mismatch: "注意: スキャンで見つかったガイドは {found} 個でしたが、ウォレット側の数は {expected} 個です。信頼できるのは {expected} 個の方です — 「もう一度調べる」を押してください。それでも違う場合、下の一覧が不完全なことがあります。",
    connected: "つながりました。ガイドを探しています…",
    rejected: "ウォレットでキャンセルされました。何も起きていません — 準備ができたらもう一度つないでください。",
    wrongChain: "ウォレットが別のネットワークになっています。42 Chain に切り替えてください。",
    switchOk: "42 Chain に切り替えました。",
    scanFailed: "チェーンを読み込めませんでした。接続を確認して「もう一度調べる」を押してください。",
    claimingStep: "請求しています… {cur} / {total} 件目。ウォレットで確認してください。",
    waitingTx: "ネットワークの完了を待っています… {cur} / {total} 件目",
    claimDone: "できました！ {amount} CAT42 を受け取りました。",
    claimDoneNoDiff: "できました！請求が完了しました。",
    txLink: "記録を見る",
    txFailed: "請求できませんでした。CAT42 は請求されていません。もう一度お試しください。",
    nothingToClaim: "いま請求できるものはありません。",
  }
};

/* ---------- pure helpers ---------- */
function pad32(hexNoPrefix) {
  var h = hexNoPrefix.toLowerCase();
  while (h.length < 64) h = "0" + h;
  return h;
}
function encodeUint(v) { return pad32(BigInt(v).toString(16)); }
function encodeAddress(addr) { return pad32(addr.replace(/^0x/i, "")); }
function callData(selector, encodedArgs) { return selector + (encodedArgs || ""); }
function encodeClaimMany(ids) {
  var out = SEL.claimMany + encodeUint(32) + encodeUint(ids.length);
  for (var i = 0; i < ids.length; i++) out += encodeUint(ids[i]);
  return out;
}
function decodeUint(hex) {
  if (!hex || hex === "0x") return null;
  return BigInt(hex);
}
function decodeAddress(hex) {
  if (!hex || hex.length < 42) return null;
  return ("0x" + hex.slice(-40)).toLowerCase();
}
function chunkArray(arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function commas(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
/* Format a wei BigInt as CAT42 with 2 decimals (truncated), with commas. */
function formatCAT(wei) {
  var w = typeof wei === "bigint" ? wei : BigInt(wei);
  var neg = w < 0n; if (neg) w = -w;
  var hundredths = w * 100n / 1000000000000000000n;
  var whole = hundredths / 100n;
  var cents = hundredths % 100n;
  var s = commas(whole.toString()) + "." + (cents < 10n ? "0" : "") + cents.toString();
  return neg ? "-" + s : s;
}
function formatInt(n) { return commas(String(n)); }
function template(str, vars) {
  return str.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? String(vars[k]) : "{" + k + "}"; });
}

/* ---------- RPC (batch eth_call, with fallback) ---------- */
var activeRpc = 0;
function fetchFn() {
  if (typeof fetch !== "undefined") return fetch;
  throw new Error("fetch unavailable");
}
async function rpcBatchOn(rpcUrl, calls) {
  var payload = calls.map(function (c, i) {
    return { jsonrpc: "2.0", id: i + 1, method: "eth_call", params: [{ to: c.to, data: c.data }, "latest"] };
  });
  var res = await fetchFn()(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("RPC HTTP " + res.status);
  var json = await res.json();
  if (!Array.isArray(json)) throw new Error("RPC bad response");
  var byId = {};
  json.forEach(function (r) { byId[r.id] = r; });
  return calls.map(function (_, i) {
    var r = byId[i + 1];
    if (!r || r.error || typeof r.result !== "string") return null;
    return r.result;
  });
}
async function rpcBatch(calls, rpcUrls) {
  var urls = rpcUrls || RPCS;
  var order = [];
  for (var k = 0; k < urls.length; k++) order.push((activeRpc + k) % urls.length);
  var lastErr = null;
  for (var j = 0; j < order.length; j++) {
    try {
      var out = await rpcBatchOn(urls[order[j]], calls);
      activeRpc = order[j];
      /* Guard against silent per-call drops: a batch answer can omit an
         entry or carry an error for a single call, which the caller would
         read as "not owned / not claimed". Retry just the missing calls
         once on the next RPC before accepting a null. A genuine revert
         (e.g. ownerOf for a burned Guide ID) fails the retry too and its
         null stands — that is a real answer, not a drop. */
      var missing = [];
      out.forEach(function (r, i) { if (r === null) missing.push(i); });
      if (missing.length && j + 1 < order.length) {
        try {
          var retryCalls = missing.map(function (i) { return calls[i]; });
          var retryOut = await rpcBatchOn(urls[order[j + 1]], retryCalls);
          retryOut.forEach(function (r, k) { if (r !== null) out[missing[k]] = r; });
        } catch (e) { /* keep the original nulls */ }
      }
      return out;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("RPC failed");
}
async function rpcSingle(to, data, rpcUrls) {
  var out = await rpcBatch([{ to: to, data: data }], rpcUrls);
  return out[0];
}

/* ---------- chain reads ---------- */
async function getGlobalStats(rpcUrls) {
  var res = await rpcBatch([
    { to: CAT42, data: SEL.claims },
    { to: CAT42, data: callData(SEL.balanceOf, encodeAddress(CAT42)) },
    { to: GUIDE, data: SEL.nextId }
  ], rpcUrls);
  return {
    claims: res[0] ? Number(decodeUint(res[0])) : null,
    vaultWei: res[1] ? decodeUint(res[1]).toString() : null,
    guideIssued: res[2] ? Number(decodeUint(res[2])) : null /* IDs are 1..nextId inclusive (see scanOwnedGuides) */
  };
}
async function getCatBalance(address, rpcUrls) {
  var r = await rpcSingle(CAT42, callData(SEL.balanceOf, encodeAddress(address)), rpcUrls);
  return r ? decodeUint(r) : null;
}
/* Scan: find every Guide owned by `owner`, then claim state.
   onProgress(done, total) is called after each ownerOf batch. */
async function scanOwnedGuides(owner, opts) {
  opts = opts || {};
  var rpcUrls = opts.rpcUrls || RPCS;
  var onProgress = opts.onProgress || function () {};
  var ownerLc = owner.toLowerCase();

  var nextIdHex = await rpcSingle(GUIDE, SEL.nextId, rpcUrls);
  if (!nextIdHex) throw new Error("nextId failed");
  /* Guide IDs run 1..nextId INCLUSIVE: nextId is the latest issued ID,
     not one past the end (verified on-chain 2026-11-14 — ownerOf(nextId)
     resolves to a real owner while nextId still equals that ID, on two
     independent RPCs). The old "- 1" silently dropped the newest Guide
     from every scan (bug report 2026-11-14: owner of #5149 saw 735/736). */
  var total = Number(decodeUint(nextIdHex));
  var balHex = await rpcSingle(GUIDE, callData(SEL.balanceOf, encodeAddress(owner)), rpcUrls);
  var balanceOfCount = balHex ? Number(decodeUint(balHex)) : null;

  var ids = [];
  for (var i = 1; i <= total; i++) ids.push(i);
  var batches = chunkArray(ids, 100);
  var owned = [];
  var scanned = 0;
  var cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      var my = cursor++;
      var batch = batches[my];
      var calls = batch.map(function (id) {
        return { to: GUIDE, data: callData(SEL.ownerOf, encodeUint(id)) };
      });
      var results = await rpcBatch(calls, rpcUrls);
      results.forEach(function (r, idx) {
        var a = decodeAddress(r);
        if (a && a === ownerLc) owned.push(batch[idx]);
      });
      scanned += batch.length;
      onProgress(scanned, total);
    }
  }
  var workers = [];
  for (var w = 0; w < Math.min(4, batches.length); w++) workers.push(worker());
  await Promise.all(workers);
  owned.sort(function (a, b) { return a - b; });

  /* claimed() for owned */
  var claimedIds = [];
  var unclaimedIds = [];
  var ownedChunks = chunkArray(owned, 100);
  for (var c = 0; c < ownedChunks.length; c++) {
    var ch = ownedChunks[c];
    var cres = await rpcBatch(ch.map(function (id) {
      return { to: CAT42, data: callData(SEL.claimed, encodeUint(id)) };
    }), rpcUrls);
    cres.forEach(function (r, idx) {
      var v = r ? decodeUint(r) : null;
      if (v && v !== 0n) claimedIds.push(ch[idx]); else unclaimedIds.push(ch[idx]);
    });
  }

  /* preview() + tier() for unclaimed (50 ids = 100 calls per batch) */
  var unclaimed = [];
  var totalPreview = 0n;
  var uChunks = chunkArray(unclaimedIds, 50);
  for (var u = 0; u < uChunks.length; u++) {
    var uch = uChunks[u];
    var calls2 = [];
    uch.forEach(function (id) { calls2.push({ to: CAT42, data: callData(SEL.preview, encodeUint(id)) }); });
    uch.forEach(function (id) { calls2.push({ to: GUIDE, data: callData(SEL.tier, encodeUint(id)) }); });
    var res2 = await rpcBatch(calls2, rpcUrls);
    uch.forEach(function (id, idx) {
      var pv = res2[idx] ? decodeUint(res2[idx]) : 0n;
      if (pv === null) pv = 0n;
      var tr = res2[uch.length + idx] ? decodeUint(res2[uch.length + idx]) : null;
      var tierNum = tr === null ? -1 : Number(tr);
      totalPreview += pv;
      unclaimed.push({ id: id, tier: tierNum, previewWei: pv.toString() });
    });
  }

  return {
    nextId: total,
    totalGuides: total,
    balanceOfCount: balanceOfCount,
    ownedIds: owned,
    claimedIds: claimedIds,
    unclaimed: unclaimed,
    totalPreviewWei: totalPreview.toString(),
    mismatch: balanceOfCount !== null && balanceOfCount !== owned.length
  };
}

/* Export for the Node verification harness. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    CAT42: CAT42, GUIDE: GUIDE,
    SEL: SEL, RPCS: RPCS, TIER_MUL: TIER_MUL, I18N: I18N,
    encodeUint: encodeUint, encodeAddress: encodeAddress, encodeClaimMany: encodeClaimMany,
    decodeUint: decodeUint, decodeAddress: decodeAddress, chunkArray: chunkArray,
    formatCAT: formatCAT, rpcBatch: rpcBatch, rpcSingle: rpcSingle,
    getGlobalStats: getGlobalStats, getCatBalance: getCatBalance,
    scanOwnedGuides: scanOwnedGuides
  };
}

/* ---------- browser UI ---------- */
if (typeof document !== "undefined" && typeof window !== "undefined") {
  (function () {
    var lang = document.documentElement.lang === "ja" ? "ja" : "en";
    var S = I18N[lang];
    function t(key, vars) { return template(S[key] || key, vars); }
    function $(id) { return document.getElementById(id); }

    /* One-time cleanup: records left behind by the prepaid site fee
       (abolished 2026-11-14) are deleted on startup, so no stale
       record can linger or be acted on. */
    try { localStorage.removeItem("cat42claim_prepaid_fee_v2"); } catch (e) {}
    try { localStorage.removeItem("cat42claim_pending_fee_v1"); } catch (e) {}

    var state = { address: null, scan: null, claiming: false };

    function applyI18n() {
      document.title = lang === "ja" ? "CAT42 請求 — ガイドを持っている方へ" : "CAT42 Claim — for Guide holders";
      var map = {
        pageTitle: "pageTitle", pageSub: "pageSub", howTitle: "howTitle",
        step1: "step1", step2: "step2", step3: "step3", howNote: "howNote",
        statsTitle: "statsTitle", statClaimsLabel: "statClaimsLabel",
        statVaultLabel: "statVaultLabel", statGuidesLabel: "statGuidesLabel",
        statsNote: "statsNote", noWalletTitle: "noWalletTitle", noWalletText: "noWalletText",
        connectBtn: "connectBtn", connectNote: "connectNote", yourWalletLabel: "yourWalletLabel",
        rescanBtn: "rescanBtn", switchChainBtn: "switchChainBtn",
        totalLabel: "totalLabel", totalNote: "totalNote",
        ownedLabel: "ownedLabel", unclaimedLabel: "unclaimedLabel", claimedLabel: "claimedLabel",
        unclaimedTitle: "unclaimedTitle", claimedSummary: "claimedSummary",
        safeTitle: "safeTitle", safe1: "safe1", safe2: "safe2", safe3: "safe3",
        contractLine: "contractLine", footerText: "footerText"
      };
      Object.keys(map).forEach(function (id) { var el = $(id); if (el) el.textContent = S[map[id]]; });
      var cb = $("claimBtn"); if (cb) cb.textContent = S.claimBtn;
    }

    /* language selector */
    var langSel = $("langSel");
    if (langSel) {
      langSel.value = lang;
      langSel.addEventListener("change", function () {
        try { localStorage.setItem("cat42claim_lang", langSel.value); } catch (e) {}
        location.href = (langSel.value === "ja" ? "ja.html" : "en.html") + location.search + location.hash;
      });
    }

    /* token icon fallback */
    var icon = $("tokenIcon");
    if (icon) {
      icon.addEventListener("error", function () {
        icon.hidden = true;
        var f = $("tokenFallback"); if (f) f.hidden = false;
      });
    }

    function setResult(el, msg, kind) {
      if (!el) return;
      el.textContent = msg || "";
      el.className = "result" + (kind ? " " + kind : "");
    }

    /* global stats, no wallet needed */
    async function loadStats() {
      try {
        var st = await getGlobalStats();
        if (st.claims !== null) $("statClaims").textContent = formatInt(st.claims);
        if (st.vaultWei !== null) $("statVault").textContent = formatCAT(BigInt(st.vaultWei)) + " CAT42";
        if (st.guideIssued !== null) $("statGuides").textContent = formatInt(st.guideIssued);
      } catch (e) {
        setResult($("statsError"), S.statsError, "error");
      }
    }

    function hasWallet() { return typeof window.ethereum !== "undefined" && window.ethereum; }

    async function ensureChain() {
      var eth = window.ethereum;
      var current = await eth.request({ method: "eth_chainId" });
      if (current && current.toLowerCase() === CHAIN_ID_HEX) return true;
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
        return true;
      } catch (e) {
        if (e && e.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN_ID_HEX, chainName: "42 Chain",
              nativeCurrency: { name: "42", symbol: "42", decimals: 18 },
              rpcUrls: ["https://evm-rpc.infinitepanda.xyz"],
              blockExplorerUrls: ["https://scan.infinitedrive.xyz"]
            }]
          });
          return true;
        }
        throw e;
      }
    }

    function txLinkDiv(hash) {
      var div = document.createElement("div");
      var a = document.createElement("a");
      a.href = EXPLORER + "/tx/" + hash;
      a.target = "_blank"; a.rel = "noreferrer";
      a.textContent = S.txLink + ": " + hash.slice(0, 10) + "…" + hash.slice(-6);
      div.appendChild(a);
      return div;
    }

    /* Totals, counts and the full Guide lists are rendered as soon as
       the scan finishes — nothing is held back. */
    function renderScan(scan) {
      state.scan = scan;
      $("mainPanel").hidden = false;
      $("ownedCount").textContent = formatInt(scan.ownedIds.length);
      $("unclaimedCount").textContent = formatInt(scan.unclaimed.length);
      $("claimedCount").textContent = formatInt(scan.claimedIds.length);
      $("totalAmount").textContent = formatCAT(BigInt(scan.totalPreviewWei));

      var mismatch = $("mismatchNote");
      if (scan.mismatch) {
        mismatch.hidden = false;
        mismatch.textContent = t("mismatch", { found: scan.ownedIds.length, expected: scan.balanceOfCount });
      } else { mismatch.hidden = true; }

      var claimBtn = $("claimBtn");
      if (scan.unclaimed.length > 0) {
        claimBtn.disabled = false;
        claimBtn.textContent = S.claimBtn;
      } else {
        claimBtn.disabled = true;
        claimBtn.textContent = S.claimBtnNone;
      }

      revealLists(scan);
    }

    function revealLists(scan) {
      var list = $("unclaimedList");
      list.innerHTML = "";
      if (scan.unclaimed.length > 0) {
        $("unclaimedTitle").hidden = false;
        $("emptyListText").hidden = true;
        scan.unclaimed.forEach(function (u) {
          var row = document.createElement("div");
          row.className = "guide-item";
          var left = document.createElement("div");
          var main = document.createElement("div");
          main.className = "guide-main";
          main.textContent = t("guideLabel", { id: u.id });
          var badge = document.createElement("span");
          var tierName = (u.tier >= 0 && u.tier < S.tiers.length) ? S.tiers[u.tier] : S.tierUnknown;
          var mul = (u.tier >= 0 && u.tier < TIER_MUL.length) ? TIER_MUL[u.tier] : null;
          badge.className = "tier-badge" + (u.tier > 0 ? " tier-" + u.tier : "");
          badge.textContent = tierName + (mul ? " ×" + mul : "");
          main.appendChild(badge);
          var sub = document.createElement("div");
          sub.className = "guide-sub";
          sub.textContent = t("expected", { amount: formatCAT(BigInt(u.previewWei)) });
          left.appendChild(main); left.appendChild(sub);
          var amt = document.createElement("div");
          amt.className = "guide-amt";
          amt.textContent = formatCAT(BigInt(u.previewWei)) + " CAT42";
          row.appendChild(left); row.appendChild(amt);
          list.appendChild(row);
        });
      } else {
        $("unclaimedTitle").hidden = true;
        $("emptyListText").hidden = false;
        $("emptyListText").textContent = scan.ownedIds.length === 0 ? S.noGuides : S.emptyList;
      }

      var det = $("claimedDetails");
      if (scan.claimedIds.length > 0) {
        det.hidden = false;
        $("claimedSummary").textContent = S.claimedSummary + " (" + scan.claimedIds.length + ")";
        var cl = $("claimedList");
        cl.innerHTML = "";
        scan.claimedIds.forEach(function (id) {
          var row = document.createElement("div");
          row.className = "guide-item";
          row.innerHTML = "";
          var d = document.createElement("div");
          d.className = "guide-main";
          d.textContent = t("guideLabel", { id: id });
          row.appendChild(d);
          cl.appendChild(row);
        });
      } else { det.hidden = true; }
    }

    async function refreshCatBalance() {
      if (!state.address) return;
      try {
        var bal = await getCatBalance(state.address);
        if (bal !== null) $("catBalanceLine").textContent = t("yourCat", { amount: formatCAT(bal) });
      } catch (e) { /* keep silent; main numbers matter more */ }
    }

    async function scanAndRender() {
      if (!state.address) return;
      $("mainPanel").hidden = false;
      $("claimBtn").disabled = true;
      setResult($("claimResult"), "");
      $("claimProgress").textContent = "";
      try {
        var scan = await scanOwnedGuides(state.address, {
          onProgress: function (done, total) {
            $("scanProgress").textContent = t("searching", { done: formatInt(done), total: formatInt(total) });
          }
        });
        $("scanProgress").textContent = "";
        renderScan(scan);
        await refreshCatBalance();
      } catch (e) {
        $("scanProgress").textContent = "";
        setResult($("connectResult"), S.scanFailed, "error");
      }
    }

    async function connect() {
      if (!hasWallet()) { $("noWalletPanel").hidden = false; return; }
      try {
        var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (!accounts || !accounts.length) return;
        var ok = await ensureChain();
        if (!ok) { setResult($("connectResult"), S.wrongChain, "error"); $("switchChainBtn").hidden = false; return; }
        state.address = accounts[0];
        $("connectBox").hidden = true;
        $("accountBox").hidden = false;
        $("walletAddr").textContent = state.address;
        setResult($("connectResult"), S.connected, "ok");
        await scanAndRender();
      } catch (e) {
        if (e && e.code === 4001) setResult($("connectResult"), S.rejected, "error");
        else setResult($("connectResult"), S.wrongChain, "error");
        var sw = $("switchChainBtn"); if (sw && state.address) sw.hidden = false;
      }
    }

    async function waitReceipt(hash) {
      for (var i = 0; i < 90; i++) {
        var r = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [hash] });
        if (r) return r;
        await new Promise(function (res) { setTimeout(res, 2000); });
      }
      return null;
    }

    /* One tap claims every unclaimed Guide via claimMany (chunks of
       100 IDs, each chunk confirmed in the wallet). The only cost is
       the chain's gas in [42] — the site itself is free. */
    async function claimAll() {
      if (state.claiming || !state.scan) return;
      var ids = state.scan.unclaimed.map(function (u) { return u.id; });
      if (ids.length === 0) {
        setResult($("claimResult"), S.nothingToClaim, "error");
        return;
      }
      state.claiming = true;
      $("claimBtn").disabled = true;
      setResult($("claimResult"), "");
      var chunks = chunkArray(ids, 100);
      var hashes = [];
      try {
        var before = await getCatBalance(state.address);
        try { await ensureChain(); } catch (e) { /* wallet will surface it on send */ }
        for (var ci = 0; ci < chunks.length; ci++) {
          $("claimProgress").textContent = t("claimingStep", { cur: ci + 1, total: chunks.length });
          var data = encodeClaimMany(chunks[ci]);
          var gasHex = null;
          try {
            var est = await window.ethereum.request({
              method: "eth_estimateGas",
              params: [{ from: state.address, to: CAT42, data: data }]
            });
            var gas = BigInt(est) * 120n / 100n;
            gasHex = "0x" + gas.toString(16);
          } catch (e) { gasHex = null; /* let the wallet estimate */ }
          var txParams = { from: state.address, to: CAT42, data: data };
          if (gasHex) txParams.gas = gasHex;
          var hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [txParams] });
          hashes.push(hash);
          $("claimProgress").textContent = t("waitingTx", { cur: ci + 1, total: chunks.length });
          var receipt = await waitReceipt(hash);
          if (!receipt || receipt.status !== "0x1") {
            throw Object.assign(new Error("tx failed"), { hash: hash });
          }
        }
        var after = await getCatBalance(state.address);
        var received = (before !== null && after !== null && after > before) ? (after - before) : null;
        $("claimProgress").textContent = "";
        await scanAndRender();
        await loadStats();
        /* Render the summary after the rescan (the rescan clears the box). */
        var box = $("claimResult");
        box.innerHTML = "";
        box.className = "result ok";
        var msg = document.createElement("div");
        if (received !== null) {
          msg.textContent = t("claimDone", { amount: formatCAT(received) });
        } else {
          msg.textContent = S.claimDoneNoDiff;
        }
        box.appendChild(msg);
        hashes.forEach(function (h) { box.appendChild(txLinkDiv(h)); });
      } catch (e) {
        $("claimProgress").textContent = "";
        var box2 = $("claimResult");
        box2.innerHTML = "";
        box2.className = "result error";
        var m = document.createElement("div");
        if (e && e.code === 4001) m.textContent = S.rejected;
        else m.textContent = S.txFailed;
        box2.appendChild(m);
        if (e && e.hash) box2.appendChild(txLinkDiv(e.hash));
        if (state.scan && state.scan.unclaimed.length > 0) $("claimBtn").disabled = false;
      } finally {
        state.claiming = false;
      }
    }

    /* wire up */
    applyI18n();
    if (!hasWallet()) $("noWalletPanel").hidden = false;
    $("connectBtn").addEventListener("click", connect);
    $("rescanBtn").addEventListener("click", scanAndRender);
    $("claimBtn").addEventListener("click", claimAll);
    $("switchChainBtn").addEventListener("click", async function () {
      try {
        await ensureChain();
        setResult($("connectResult"), S.switchOk, "ok");
        $("switchChainBtn").hidden = true;
        if (state.address) await scanAndRender();
      } catch (e) {
        if (e && e.code === 4001) setResult($("connectResult"), S.rejected, "error");
        else setResult($("connectResult"), S.wrongChain, "error");
      }
    });
    if (hasWallet() && window.ethereum.on) {
      window.ethereum.on("accountsChanged", function (accs) {
        if (!accs || !accs.length) {
          state.address = null; state.scan = null;
          $("accountBox").hidden = true; $("connectBox").hidden = false; $("mainPanel").hidden = true;
          return;
        }
        state.address = accs[0];
        $("walletAddr").textContent = state.address;
        scanAndRender();
      });
      window.ethereum.on("chainChanged", function () {
        if (state.address) scanAndRender();
      });
    }
    loadStats();
  })();
}

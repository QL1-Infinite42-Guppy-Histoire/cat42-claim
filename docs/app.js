"use strict";
/* CAT42 Claim — vanilla JS only. No web3 library.
   Pure helpers + scan logic are exported for the Node verification harness
   (see tools/verify.js) when run outside a browser. */

var CAT42 = "0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310";
var GUIDE = "0xF349E469C474048DEd6F9b914309E76880ED1bbD";
var ZAP = "0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256";
var ROUTER = "0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0"; // Infinite router (42 Chain)
var BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
/* Site fee: 5% of the CAT42 actually received in a claim session is swapped
   to ZAP and all of that ZAP is burned. See README "サイト手数料". */
var FEE_NUM = 5n;
var FEE_DEN = 100n;
var FEE_SLIPPAGE_NUM = 98n; // swap accepts >= 98% of the fresh quote
var FEE_SLIPPAGE_DEN = 100n;
var FEE_DEADLINE_SECS = 600; // 10 minutes
var PENDING_FEE_KEY = "cat42claim_pending_fee_v1";
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
  tier: "0x6dda34db",
  approve: "0x095ea7b3",
  allowance: "0xdd62ed3e",
  transfer: "0xa9059cbb",
  swapExactTokensForTokens: "0x38ed1739",
  getAmountsOut: "0xd06ca61f"
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
    step3: "Tap the big button once — you get everything at once",
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
    claimBtn: "Claim all at once 🐱",
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
    estimating: "Checking the fee…",
    feeTitle: "About the site fee",
    feeNote: "This site takes a small fee. Of the CAT42 you claim here, 5% is swapped into a token called ZAP, and all of that ZAP is burned (sent to an address nobody can ever use). The other 95% is all yours. The fee steps happen right after your claim, in this same flow — your wallet will ask you to confirm each step. The fee only applies when you claim through this site.",
    feeEstimate: "If you claim now: fee about {fee} CAT42 → swapped into about {zap} ZAP and burned.",
    feeEstimateNoZap: "If you claim now: fee about {fee} CAT42 (swapped into ZAP and burned).",
    feeZeroNote: "For this claim, 5% rounds down to 0, so no fee is taken.",
    feeNotMeasured: "We could not measure exactly how much CAT42 arrived, so no site fee was taken this time.",
    feeApproveStep: "Site fee, step 1 of 3: please confirm the approval in your wallet.",
    feeSwapStep: "Site fee, step 2 of 3: swapping the fee CAT42 into ZAP. Please confirm in your wallet.",
    feeBurnStep: "Site fee, step 3 of 3: burning the ZAP. Please confirm in your wallet.",
    feeWaiting: "Waiting for the network to finish…",
    feeDoneLine: "Site fee: {fee} CAT42 was swapped into {zap} ZAP, and all of that ZAP was burned.",
    feeDoneTitle: "Site fee — done",
    feePendingTitle: "Site fee not finished yet",
    feePendingText: "Your claim itself is complete and your CAT42 is safe. Only the site fee is left: {fee} CAT42 still needs to be swapped into ZAP and burned. Tap the button below to finish — your wallet will ask you to confirm each step.",
    feeResumeBtn: "Finish the fee steps",
    feeRejected: "You cancelled in your wallet. The fee is not finished yet — you can continue any time with the button below.",
    feeFailed: "A fee step did not go through. Your claimed CAT42 is safe, and the fee is not finished yet — you can continue any time with the button below.",
    feeUnconfirmed: "The burn was sent, but we could not confirm the final numbers yet. Please check the record link, then tap the button to check again — do not worry, the fee will not be charged twice.",
    feeNothingToBurn: "There was no ZAP left to burn, so the fee is closed.",
    feeCheckAgainBtn: "Check the fee again"
  },
  ja: {
    pageTitle: "CAT42 請求 🐱",
    pageSub: "ガイドを持っていると、CAT42 がもらえるかもしれません",
    howTitle: "使い方はかんたん 3ステップ",
    step1: "ウォレットをつなぐ（ガイドが入っているウォレット）",
    step2: "あなたのガイドを探して、もらえる量を調べます",
    step3: "大きなボタンを1回押すだけ — まとめて全部もらえます",
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
    claimBtn: "まとめて全部もらう 🐱",
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
    estimating: "手数料を調べています…",
    feeTitle: "サイト手数料について",
    feeNote: "このサイトでは、ささやかな手数料をいただいています。ここで請求した CAT42 のうち 5% を ZAP というトークンに交換し、その ZAP はすべてバーン（誰も使えないアドレスへの送金）します。残りの 95% はすべてあなたのものです。手数料のステップは請求の直後に同じ流れで進みます — そのつどウォレットで確認をお願いします。この手数料は、このサイトから請求した場合にだけかかります。",
    feeEstimate: "いま請求すると、手数料は約 {fee} CAT42 → 約 {zap} ZAP に交換してバーンします。",
    feeEstimateNoZap: "いま請求すると、手数料は約 {fee} CAT42 です（ZAP に交換してバーンします）。",
    feeZeroNote: "今回の請求では、5% が切り捨てで 0 になるため、手数料はいただきません。",
    feeNotMeasured: "受け取った CAT42 の量を正確に測れなかったため、今回は手数料をいただきませんでした。",
    feeApproveStep: "サイト手数料 1/3: ウォレットで承認を確認してください。",
    feeSwapStep: "サイト手数料 2/3: 手数料分の CAT42 を ZAP に交換します。ウォレットで確認してください。",
    feeBurnStep: "サイト手数料 3/3: ZAP をバーンします。ウォレットで確認してください。",
    feeWaiting: "ネットワークの完了を待っています…",
    feeDoneLine: "サイト手数料: {fee} CAT42 を {zap} ZAP に交換し、その ZAP をすべてバーンしました。",
    feeDoneTitle: "サイト手数料 — 完了",
    feePendingTitle: "サイト手数料がまだ終わっていません",
    feePendingText: "請求そのものは完了していて、あなたの CAT42 は無事です。残っているのはサイト手数料だけです： {fee} CAT42 を ZAP に交換してバーンするところまで進めてください。下のボタンを押すと続きができます — そのつどウォレットで確認をお願いします。",
    feeResumeBtn: "手数料の続きをする",
    feeRejected: "ウォレットでキャンセルされました。手数料はまだ終わっていません — 下のボタンでいつでも続きができます。",
    feeFailed: "手数料のステップが通りませんでした。請求した CAT42 は無事です。手数料はまだ終わっていません — 下のボタンでいつでも続きができます。",
    feeUnconfirmed: "バーンは送信しましたが、最後の数字をまだ確認できていません。記録のリンクを確認してから、下のボタンで再確認してください — 手数料が二重にかかることはありません。",
    feeNothingToBurn: "バーンする ZAP が残っていなかったため、手数料は終了しました。",
    feeCheckAgainBtn: "手数料を再確認する"
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

/* ---------- site fee helpers (pure) ---------- */
/* 5% of what actually arrived, rounded down. 0 means: no fee phase. */
function computeFeeWei(receivedWei) {
  var w = typeof receivedWei === "bigint" ? receivedWei : BigInt(receivedWei);
  if (w <= 0n) return 0n;
  return w * FEE_NUM / FEE_DEN;
}
function encodeApprove(spender, amountWei) {
  return callData(SEL.approve, encodeAddress(spender) + encodeUint(amountWei));
}
function encodeTransfer(to, amountWei) {
  return callData(SEL.transfer, encodeAddress(to) + encodeUint(amountWei));
}
function encodeSwapExactTokensForTokens(amountInWei, amountOutMinWei, path, to, deadlineSecs) {
  var head = encodeUint(amountInWei) + encodeUint(amountOutMinWei) + encodeUint(160) +
    encodeAddress(to) + encodeUint(deadlineSecs);
  var tail = encodeUint(path.length);
  for (var i = 0; i < path.length; i++) tail += encodeAddress(path[i]);
  return callData(SEL.swapExactTokensForTokens, head + tail);
}
function encodeGetAmountsOut(amountInWei, path) {
  var tail = encodeUint(path.length);
  for (var i = 0; i < path.length; i++) tail += encodeAddress(path[i]);
  return callData(SEL.getAmountsOut, encodeUint(amountInWei) + encodeUint(64) + tail);
}
/* getAmountsOut returns uint256[] — decode to an array of BigInt (or null). */
function decodeAmountsOut(hex) {
  if (!hex || typeof hex !== "string" || hex.length < 2 + 128) return null;
  var body = hex.slice(2);
  var len = Number(BigInt("0x" + body.slice(64, 128)));
  if (!(len > 0) || body.length < 128 + len * 64) return null;
  var out = [];
  for (var i = 0; i < len; i++) out.push(BigInt("0x" + body.slice(128 + i * 64, 192 + i * 64)));
  return out;
}
/* ZAP received in a swap, parsed from the receipt's Transfer logs (fallback
   when balance reads fail): sum of ZAP transfers TO the user in this tx. */
function zapReceivedFromLogs(receipt, userAddress) {
  if (!receipt || !Array.isArray(receipt.logs)) return null;
  var userTopic = "0x" + encodeAddress(userAddress);
  var total = 0n;
  var found = false;
  receipt.logs.forEach(function (log) {
    if (!log || !log.address || log.address.toLowerCase() !== ZAP.toLowerCase()) return;
    if (!log.topics || log.topics.length < 3) return;
    if (String(log.topics[0]).toLowerCase() !== "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") return;
    if (String(log.topics[2]).toLowerCase() !== userTopic.toLowerCase()) return;
    try { total += BigInt(log.data); found = true; } catch (e) { /* skip bad log */ }
  });
  return found ? total : null;
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
    guideIssued: res[2] ? Number(decodeUint(res[2])) - 1 : null
  };
}
async function getCatBalance(address, rpcUrls) {
  var r = await rpcSingle(CAT42, callData(SEL.balanceOf, encodeAddress(address)), rpcUrls);
  return r ? decodeUint(r) : null;
}
async function getErc20Balance(token, address, rpcUrls) {
  var r = await rpcSingle(token, callData(SEL.balanceOf, encodeAddress(address)), rpcUrls);
  return r ? decodeUint(r) : null;
}
async function getZapBalance(address, rpcUrls) {
  return getErc20Balance(ZAP, address, rpcUrls);
}
async function getCatAllowance(owner, spender, rpcUrls) {
  var r = await rpcSingle(CAT42, callData(SEL.allowance, encodeAddress(owner) + encodeAddress(spender)), rpcUrls);
  return r ? decodeUint(r) : null;
}
/* Fresh router quote: how much ZAP `amountInWei` CAT42 buys right now.
   Returns the output BigInt, or null when the quote cannot be read. */
async function quoteZapOut(amountInWei, rpcUrls) {
  var w = typeof amountInWei === "bigint" ? amountInWei : BigInt(amountInWei);
  if (w <= 0n) return null;
  var r = await rpcSingle(ROUTER, encodeGetAmountsOut(w, [CAT42, ZAP]), rpcUrls);
  var amounts = decodeAmountsOut(r);
  if (!amounts || amounts.length < 2) return null;
  return amounts[amounts.length - 1];
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
  var total = Number(decodeUint(nextIdHex)) - 1;
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
    nextId: total + 1,
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
    CAT42: CAT42, GUIDE: GUIDE, ZAP: ZAP, ROUTER: ROUTER, BURN_ADDRESS: BURN_ADDRESS,
    SEL: SEL, RPCS: RPCS, TIER_MUL: TIER_MUL,
    encodeUint: encodeUint, encodeAddress: encodeAddress, encodeClaimMany: encodeClaimMany,
    decodeUint: decodeUint, decodeAddress: decodeAddress, chunkArray: chunkArray,
    formatCAT: formatCAT, rpcBatch: rpcBatch, rpcSingle: rpcSingle,
    getGlobalStats: getGlobalStats, getCatBalance: getCatBalance,
    scanOwnedGuides: scanOwnedGuides,
    computeFeeWei: computeFeeWei, encodeApprove: encodeApprove, encodeTransfer: encodeTransfer,
    encodeSwapExactTokensForTokens: encodeSwapExactTokensForTokens,
    encodeGetAmountsOut: encodeGetAmountsOut, decodeAmountsOut: decodeAmountsOut,
    zapReceivedFromLogs: zapReceivedFromLogs,
    getErc20Balance: getErc20Balance, getZapBalance: getZapBalance,
    getCatAllowance: getCatAllowance, quoteZapOut: quoteZapOut
  };
}

/* ---------- browser UI ---------- */
if (typeof document !== "undefined" && typeof window !== "undefined") {
  (function () {
    var lang = document.documentElement.lang === "ja" ? "ja" : "en";
    var S = I18N[lang];
    function t(key, vars) { return template(S[key] || key, vars); }
    function $(id) { return document.getElementById(id); }

    var state = { address: null, scan: null, claiming: false, feeRunning: false, feeSticky: false };

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
        feeTitle: "feeTitle", feeNote: "feeNote",
        feePendingTitle: "feePendingTitle",
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

    /* Disclosure estimate above the claim button: fee from the preview total,
       with a fresh ZAP quote when it can be read. */
    async function updateFeeEstimate(scan) {
      var el = $("feeEstimate");
      if (!el) return;
      var feeEst = computeFeeWei(BigInt(scan.totalPreviewWei));
      if (scan.unclaimed.length === 0) { el.textContent = ""; return; }
      if (feeEst <= 0n) { el.textContent = S.feeZeroNote; return; }
      el.textContent = t("feeEstimateNoZap", { fee: formatCAT(feeEst) });
      try {
        var zapEst = await quoteZapOut(feeEst);
        if (zapEst !== null && zapEst > 0n && state.scan === scan) {
          el.textContent = t("feeEstimate", { fee: formatCAT(feeEst), zap: formatCAT(zapEst) });
        }
      } catch (e) { /* keep the CAT42-only estimate */ }
    }

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
        claimBtn.textContent = S.claimBtn + " (" + scan.unclaimed.length + ")";
      } else {
        claimBtn.disabled = true;
        claimBtn.textContent = S.claimBtnNone;
      }
      updateFeeEstimate(scan);

      var list = $("unclaimedList");
      list.innerHTML = "";
      if (scan.ownedIds.length === 0) {
        $("emptyListText").hidden = false;
        $("emptyListText").textContent = S.noGuides;
      } else if (scan.unclaimed.length === 0) {
        $("emptyListText").hidden = false;
        $("emptyListText").textContent = S.emptyList;
      } else {
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
        refreshFeePanel();
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

    /* ---------- site fee phase ----------
       Runs after a successful claim, in the same session. A minimal record is
       kept in localStorage so an interrupted fee (wallet rejected, page
       closed) can be resumed later with the same wallet. The fee is only
       reported done when the burn is confirmed AND the ZAP movement checks
       out (receipt Transfer log to the burn address, or balance diff). */
    function loadPendingFee() {
      try {
        var raw = localStorage.getItem(PENDING_FEE_KEY);
        if (!raw) return null;
        var r = JSON.parse(raw);
        if (!r || !r.address || !r.feeWei || !r.stage) return null;
        return r;
      } catch (e) { return null; }
    }
    function savePendingFee(r) {
      try { localStorage.setItem(PENDING_FEE_KEY, JSON.stringify(r)); } catch (e) {}
    }
    function clearPendingFee() {
      try { localStorage.removeItem(PENDING_FEE_KEY); } catch (e) {}
    }
    function feeErr(msg, hash) {
      var e = new Error(msg);
      if (hash) e.hash = hash;
      return e;
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
    async function pollZapBalance() {
      for (var i = 0; i < 4; i++) {
        var b = await getZapBalance(state.address).catch(function () { return null; });
        if (b !== null) return b;
        await new Promise(function (res) { setTimeout(res, 1500); });
      }
      return null;
    }
    /* Send via the wallet with the site's usual gas estimate (+20%).
       Returns { hash, receipt } — receipt may be null if it is still
       pending after the wait; callers must not blindly resend then. */
    async function sendWalletTx(to, data, progressMsg) {
      var gasHex = null;
      try {
        var est = await window.ethereum.request({
          method: "eth_estimateGas",
          params: [{ from: state.address, to: to, data: data }]
        });
        gasHex = "0x" + (BigInt(est) * 120n / 100n).toString(16);
      } catch (e) { gasHex = null; }
      var txParams = { from: state.address, to: to, data: data };
      if (gasHex) txParams.gas = gasHex;
      if (progressMsg) $("feeProgress").textContent = progressMsg;
      var hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [txParams] });
      $("feeProgress").textContent = S.feeWaiting;
      var receipt = await waitReceipt(hash);
      return { hash: hash, receipt: receipt };
    }
    async function getReceiptViaWallet(hash) {
      try {
        return await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [hash] });
      } catch (e) { return null; }
    }
    /* Proof the burn happened: the burn tx succeeded AND either its logs show
       the ZAP moving from the user to the burn address, or (when a pre-burn
       balance was recorded) the ZAP balance dropped by exactly the amount. */
    async function verifyBurn(record) {
      if (!record.burnTx) return false;
      var receipt = await getReceiptViaWallet(record.burnTx);
      if (!receipt || receipt.status !== "0x1") return false;
      var amt = BigInt(record.burnAmountWei || "0");
      if (Array.isArray(receipt.logs)) {
        var burnTopic = "0x" + encodeAddress(BURN_ADDRESS);
        var userTopic = "0x" + encodeAddress(state.address);
        for (var i = 0; i < receipt.logs.length; i++) {
          var log = receipt.logs[i];
          if (!log || !log.address || log.address.toLowerCase() !== ZAP.toLowerCase()) continue;
          if (!log.topics || log.topics.length < 3) continue;
          if (String(log.topics[0]).toLowerCase() !== "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") continue;
          if (String(log.topics[1]).toLowerCase() !== userTopic.toLowerCase()) continue;
          if (String(log.topics[2]).toLowerCase() !== burnTopic.toLowerCase()) continue;
          try { if (BigInt(log.data) === amt) return true; } catch (e) { /* keep checking */ }
        }
      }
      if (record.zapBalBefore !== null && record.zapBalBefore !== undefined) {
        var after = await pollZapBalance();
        if (after !== null && BigInt(record.zapBalBefore) - after === amt) return true;
      }
      return false;
    }

    function setFeeProgress(msg) { var el = $("feeProgress"); if (el) el.textContent = msg || ""; }

    function finishFeeUi(kind, record, hashes, err) {
      hashes = hashes || {};
      setFeeProgress("");
      state.feeSticky = true;
      $("feePanel").hidden = false;
      var title = $("feePendingTitle");
      var text = $("feePendingText");
      var btn = $("feeResumeBtn");
      var box = $("feeResult");
      box.innerHTML = "";
      if (kind === "done" || kind === "closed") {
        title.textContent = S.feeDoneTitle;
        text.textContent = "";
        btn.hidden = true;
        box.className = "result ok";
        var line = document.createElement("div");
        if (kind === "done") {
          line.textContent = t("feeDoneLine", {
            fee: formatCAT(BigInt(record.feeWei)),
            zap: formatCAT(BigInt(record.burnAmountWei || record.zapWei || "0"))
          });
        } else {
          line.textContent = S.feeNothingToBurn;
        }
        box.appendChild(line);
      } else {
        title.textContent = S.feePendingTitle;
        text.textContent = t("feePendingText", { fee: formatCAT(BigInt(record.feeWei)) });
        btn.hidden = false;
        btn.textContent = record.burnTx ? S.feeCheckAgainBtn : S.feeResumeBtn;
        box.className = "result error";
        var msg = document.createElement("div");
        if (kind === "rejected") msg.textContent = S.feeRejected;
        else if (kind === "unconfirmed") msg.textContent = S.feeUnconfirmed;
        else msg.textContent = S.feeFailed;
        box.appendChild(msg);
      }
      ["approve", "swap", "burn"].forEach(function (k) {
        if (hashes[k]) box.appendChild(txLinkDiv(hashes[k]));
      });
      if (err && err.hash && !hashes.approve && !hashes.swap && !hashes.burn) {
        box.appendChild(txLinkDiv(err.hash));
      }
    }

    function refreshFeePanel() {
      var panel = $("feePanel");
      if (!panel) return;
      var record = loadPendingFee();
      if (state.address && record && record.address.toLowerCase() === state.address.toLowerCase()) {
        state.feeSticky = true;
        panel.hidden = false;
        $("feePendingTitle").textContent = S.feePendingTitle;
        $("feePendingText").textContent = t("feePendingText", { fee: formatCAT(BigInt(record.feeWei)) });
        var btn = $("feeResumeBtn");
        btn.hidden = false;
        btn.textContent = record.burnTx ? S.feeCheckAgainBtn : S.feeResumeBtn;
      } else if (!state.feeSticky) {
        panel.hidden = true;
      }
    }

    async function runFeePhase() {
      var record = loadPendingFee();
      if (!record || !state.address || state.feeRunning) return;
      if (record.address.toLowerCase() !== state.address.toLowerCase()) return;
      state.feeRunning = true;
      state.feeSticky = true;
      $("feePanel").hidden = false;
      $("feeResumeBtn").hidden = true;
      $("feeResult").innerHTML = "";
      var feeWei = BigInt(record.feeWei);
      var hashes = record.hashes || {};
      try {
        try { await ensureChain(); } catch (e) { /* the wallet will surface it on send */ }

        if (record.stage === "swap") {
          /* A previous swap send may already be on its way — check first. */
          var swapReceipt = null;
          if (record.pendingSwapTx) {
            swapReceipt = await getReceiptViaWallet(record.pendingSwapTx);
            if (swapReceipt && swapReceipt.status !== "0x1") {
              delete record.pendingSwapTx; savePendingFee(record); swapReceipt = null;
            } else if (!swapReceipt) {
              finishFeeUi("unconfirmed", record, hashes);
              return;
            } else {
              hashes.swap = record.pendingSwapTx;
            }
          }
          if (!swapReceipt) {
            var allow = await getCatAllowance(state.address, ROUTER).catch(function () { return null; });
            if (allow === null || allow < feeWei) {
              var ap = await sendWalletTx(CAT42, encodeApprove(ROUTER, feeWei), S.feeApproveStep);
              hashes.approve = ap.hash;
              record.hashes = hashes; savePendingFee(record);
              if (!ap.receipt) { finishFeeUi("unconfirmed", record, hashes); return; }
              if (ap.receipt.status !== "0x1") throw feeErr("approve failed", ap.hash);
            }
            var quote = await quoteZapOut(feeWei);
            if (quote === null || quote <= 0n) throw feeErr("quote unavailable");
            var minOut = quote * FEE_SLIPPAGE_NUM / FEE_SLIPPAGE_DEN;
            var zapBefore = await getZapBalance(state.address).catch(function () { return null; });
            record.zapBeforeSwap = zapBefore !== null ? zapBefore.toString() : null;
            savePendingFee(record);
            var deadline = Math.floor(Date.now() / 1000) + FEE_DEADLINE_SECS;
            var sw = await sendWalletTx(
              ROUTER,
              encodeSwapExactTokensForTokens(feeWei, minOut, [CAT42, ZAP], state.address, deadline),
              S.feeSwapStep
            );
            hashes.swap = sw.hash;
            record.hashes = hashes;
            if (!sw.receipt) {
              record.pendingSwapTx = sw.hash; savePendingFee(record);
              finishFeeUi("unconfirmed", record, hashes);
              return;
            }
            if (sw.receipt.status !== "0x1") { savePendingFee(record); throw feeErr("swap failed", sw.hash); }
            swapReceipt = sw.receipt;
            delete record.pendingSwapTx;
          }
          /* Measure the ZAP that actually arrived: balance diff first,
             the swap receipt's Transfer logs as fallback. */
          var zapReceived = null;
          var zapAfter = await pollZapBalance();
          if (record.zapBeforeSwap !== null && record.zapBeforeSwap !== undefined && zapAfter !== null) {
            var diff = zapAfter - BigInt(record.zapBeforeSwap);
            if (diff >= 0n) zapReceived = diff;
          }
          if (zapReceived === null) zapReceived = zapReceivedFromLogs(swapReceipt, state.address);
          if (zapReceived === null) {
            record.stage = "burn"; record.zapWei = null; record.hashes = hashes; savePendingFee(record);
            finishFeeUi("unconfirmed", record, hashes);
            return;
          }
          record.stage = "burn";
          record.zapWei = zapReceived.toString();
          record.hashes = hashes;
          savePendingFee(record);
        }

        if (record.stage === "burn") {
          if (record.burnTx) {
            /* Never resend a burn — only verify the one already sent. */
            var okSent = await verifyBurn(record);
            if (okSent) { clearPendingFee(); finishFeeUi("done", record, hashes); }
            else finishFeeUi("unconfirmed", record, hashes);
            return;
          }
          if (record.zapWei === null || record.zapWei === undefined) {
            /* Recover the swapped amount from the swap receipt's logs. */
            var rec2 = hashes.swap ? await getReceiptViaWallet(hashes.swap) : null;
            var got = rec2 ? zapReceivedFromLogs(rec2, state.address) : null;
            if (got === null) { finishFeeUi("unconfirmed", record, hashes); return; }
            record.zapWei = got.toString(); savePendingFee(record);
          }
          var zapWei = BigInt(record.zapWei);
          var balNow = await pollZapBalance();
          var sendAmt = zapWei;
          if (balNow !== null && balNow < sendAmt) sendAmt = balNow;
          if (sendAmt <= 0n) {
            clearPendingFee();
            finishFeeUi("closed", record, hashes);
            return;
          }
          record.zapBalBefore = balNow !== null ? balNow.toString() : null;
          savePendingFee(record);
          var bn = await sendWalletTx(ZAP, encodeTransfer(BURN_ADDRESS, sendAmt), S.feeBurnStep);
          hashes.burn = bn.hash;
          record.burnTx = bn.hash;
          record.burnAmountWei = sendAmt.toString();
          record.hashes = hashes;
          savePendingFee(record);
          if (!bn.receipt) { finishFeeUi("unconfirmed", record, hashes); return; }
          if (bn.receipt.status !== "0x1") {
            delete record.burnTx; delete record.burnAmountWei; savePendingFee(record);
            throw feeErr("burn failed", bn.hash);
          }
          var okBurn = await verifyBurn(record);
          if (okBurn) { clearPendingFee(); finishFeeUi("done", record, hashes); }
          else finishFeeUi("unconfirmed", record, hashes);
          return;
        }
      } catch (e) {
        setFeeProgress("");
        if (e && e.code === 4001) finishFeeUi("rejected", record, hashes, e);
        else finishFeeUi("failed", record, hashes, e);
      } finally {
        state.feeRunning = false;
      }
    }

    async function claimAll() {
      if (state.claiming || !state.scan || state.scan.unclaimed.length === 0) {
        if (state.scan && state.scan.unclaimed.length === 0) setResult($("claimResult"), S.nothingToClaim, "error");
        return;
      }
      state.claiming = true;
      $("claimBtn").disabled = true;
      setResult($("claimResult"), "");
      var ids = state.scan.unclaimed.map(function (u) { return u.id; });
      var chunks = chunkArray(ids, 100);
      var hashes = [];
      try {
        var before = await getCatBalance(state.address);
        try { await ensureChain(); } catch (e) { /* wallet will surface it on send */ }
        for (var ci = 0; ci < chunks.length; ci++) {
          $("claimProgress").textContent = chunks.length > 1
            ? t("claimingStep", { cur: ci + 1, total: chunks.length })
            : S.estimating;
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
        /* Site fee phase: 5% of what actually arrived, swapped to ZAP and
           burned, right here in the same flow. runFeePhase keeps its own
           errors — a fee problem never re-labels the finished claim. */
        if (received === null) {
          var note1 = document.createElement("div");
          note1.textContent = S.feeNotMeasured;
          box.appendChild(note1);
        } else {
          var feeWei = computeFeeWei(received);
          if (feeWei <= 0n) {
            var note2 = document.createElement("div");
            note2.textContent = S.feeZeroNote;
            box.appendChild(note2);
          } else {
            savePendingFee({
              address: state.address,
              receivedWei: received.toString(),
              feeWei: feeWei.toString(),
              stage: "swap",
              zapWei: null,
              hashes: {},
              createdAt: Date.now()
            });
            state.feeSticky = true;
            $("feePanel").hidden = false;
            $("feePanel").scrollIntoView({ block: "nearest" });
            await runFeePhase();
          }
        }
      } catch (e) {
        $("claimProgress").textContent = "";
        var box2 = $("claimResult");
        box2.innerHTML = "";
        box2.className = "result error";
        var m = document.createElement("div");
        if (e && e.code === 4001) m.textContent = S.rejected;
        else m.textContent = S.txFailed;
        box2.appendChild(m);
        if (e && e.hash) {
          var div2 = document.createElement("div");
          var a2 = document.createElement("a");
          a2.href = EXPLORER + "/tx/" + e.hash;
          a2.target = "_blank"; a2.rel = "noreferrer";
          a2.textContent = S.txLink + ": " + e.hash;
          div2.appendChild(a2);
          box2.appendChild(div2);
        }
        if (state.scan) $("claimBtn").disabled = state.scan.unclaimed.length === 0;
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
    $("feeResumeBtn").addEventListener("click", function () { runFeePhase(); });
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
          state.address = null; state.scan = null; state.feeSticky = false;
          $("accountBox").hidden = true; $("connectBox").hidden = false; $("mainPanel").hidden = true;
          $("feePanel").hidden = true;
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

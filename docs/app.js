"use strict";
/* CAT42 Claim — vanilla JS only. No web3 library.
   Pure helpers + scan logic are exported for the Node verification harness
   (see tools/verify.js) when run outside a browser. */

var CAT42 = "0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310";
var GUIDE = "0xF349E469C474048DEd6F9b914309E76880ED1bbD";
var ZAP = "0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256";
var ROUTER = "0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0"; // Infinite router (42 Chain)
var BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";
/* Site fee (prepaid, ZAP only): before the claim unlocks, the user burns
   ZAP worth 5% of the estimated claim (preview total), converted at the
   live CAT42/ZAP quote. The claim button stays locked until the burn is
   verified from its receipt, so inside the site flow there is no
   claim-first-dodge-later gap. See README "サイト手数料". */
var FEE_NUM = 5n;
var FEE_DEN = 100n;
var PENDING_FEE_KEY = "cat42claim_prepaid_fee_v2";
var LEGACY_PENDING_FEE_KEY = "cat42claim_pending_fee_v1"; // old post-claim design; ignored + cleared
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
  transfer: "0xa9059cbb",
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
    step3: "Pay the small site fee in ZAP — then the claim starts right away",
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
    feeNote: "This site charges a small fee, paid before you claim. The fee is 5% of the CAT42 you are about to claim, worked out from the estimate above, and you pay it in a token called ZAP. The ZAP is burned (sent to an address nobody can ever use). Please know two things before you pay: (1) the fee is figured from the estimated amounts — what you actually receive can be a little different, because each Guide pays a little less than the one before; (2) once the ZAP is burned it cannot be refunded, even if you then stop, or the claim does not go through. To keep that risk small, your claim starts right after the fee is confirmed. Your Guide list is shown after the fee is paid. The fee only applies when you claim through this site.",
    feeEstimate: "Estimated fee: about {fee} CAT42 worth ≈ {zap} ZAP (burned before you claim).",
    feeEstimateNoZap: "Estimated fee: about {fee} CAT42 worth (the ZAP amount could not be read just now).",
    feeZeroNote: "For this claim, 5% of the estimate rounds down to 0, so no fee is needed — you can claim right away.",
    claimBtnLocked: "Claim all at once 🐱 (pay the fee first)",
    feeReadyText: "Tap the button below to burn {zap} ZAP as the site fee. Your claim starts right after the burn is confirmed.",
    feeBurnBtn: "Burn {zap} ZAP and continue",
    feePayStep: "Site fee: please confirm the ZAP burn in your wallet.",
    feeWaiting: "Waiting for the network to finish…",
    feePaidNote: "Fee paid: {zap} ZAP was burned (worth about {fee} CAT42 by the estimate). Starting your claim…",
    feePaidLine: "Site fee (paid first): {zap} ZAP burned — about {fee} CAT42 worth by the estimate.",
    feeHonoredNote: "You already paid the fee for {n} Guide(s) — you will not be charged again for them.",
    feeHonoredExtra: " {extra} more Guide(s) are not covered by that payment; they can be claimed in a new round afterwards.",
    feePendingTitle: "Site fee (paid first)",
    feeShortfall: "The fee needs about {zap} ZAP, but you have {bal} ZAP — about {short} ZAP short. You cannot claim through this site until you have enough ZAP. Ways to get ZAP: the 42 faucet gives out 1 ZAP at a time, and ZAP can also be bought on the exchange (DEX) on 42 Chain. Once you have some, tap “Check again”.",
    feeBalanceUnknown: "Your ZAP balance could not be read. Please tap the button below to check again.",
    feeQuoteFailed: "The fee in ZAP could not be worked out right now. Please tap the button below to try again in a little while.",
    feeCheckAgainBtn: "Check again",
    feeVerifyBtn: "Check the fee payment",
    feeBurnRejected: "You cancelled in your wallet. Nothing was burned — tap the button when you are ready to pay the fee.",
    feeBurnFailed: "The burn did not go through, so nothing was charged. You can try again.",
    feeUnconfirmed: "The burn was sent, but we could not confirm it yet. Please tap the button below to check again — the fee will not be charged twice.",
    faucetLinkText: "Open the 42 faucet"
  },
  ja: {
    pageTitle: "CAT42 請求 🐱",
    pageSub: "ガイドを持っていると、CAT42 がもらえるかもしれません",
    howTitle: "使い方はかんたん 3ステップ",
    step1: "ウォレットをつなぐ（ガイドが入っているウォレット）",
    step2: "あなたのガイドを探して、もらえる量を調べます",
    step3: "ZAP でサイト手数料を払うと、そのまま請求が始まります",
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
    feeNote: "このサイトでは、手数料を請求の前にいただいています。手数料は、これから請求する CAT42 の見込み額の 5% を、ZAP というトークンで払う形です。その ZAP はバーン（誰も使えないアドレスへの送金）されます。払う前に2つ知っておいてください： (1) 手数料は見込み額から計算します — ガイド1つごとに少しずつもらえる量が減るため、実際に受け取る量は少し変わることがあります。(2) バーンした ZAP は、あとで請求をやめたり、請求が通らなかったりしても、戻ってきません。そのリスクを小さくするため、手数料の確認が取れたらすぐに請求が始まります。請求できるガイドの一覧は、手数料を払ったあとに表示されます。この手数料は、このサイトから請求した場合にだけかかります。",
    feeEstimate: "手数料（見込み）: 約 {fee} CAT42 分 ≒ 約 {zap} ZAP（請求の前にバーンします）。",
    feeEstimateNoZap: "手数料（見込み）: 約 {fee} CAT42 分です（ZAP の量をいま読み取れませんでした）。",
    feeZeroNote: "今回の請求では、見込み額の 5% が切り捨てで 0 になるため、手数料は不要です — そのまま請求できます。",
    claimBtnLocked: "まとめて全部もらう 🐱（先に手数料）",
    feeReadyText: "下のボタンを押すと、手数料として {zap} ZAP をバーンします。バーンが確認できたら、すぐに請求が始まります。",
    feeBurnBtn: "{zap} ZAP をバーンして進む",
    feePayStep: "サイト手数料: ウォレットで ZAP のバーンを確認してください。",
    feeWaiting: "ネットワークの完了を待っています…",
    feePaidNote: "手数料を払いました: {zap} ZAP をバーンしました（見込みで約 {fee} CAT42 分）。請求を始めます…",
    feePaidLine: "サイト手数料（先払い）: {zap} ZAP をバーンしました — 見込みで約 {fee} CAT42 分です。",
    feeHonoredNote: "{n} 個のガイドは手数料を払い済みです — その分は二重にはいただきません。",
    feeHonoredExtra: "残りの {extra} 個は今回の支払いに含まれていません。あとでもう一度請求できます。",
    feePendingTitle: "サイト手数料（先払い）",
    feeShortfall: "手数料には約 {zap} ZAP が必要ですが、いま持っているのは {bal} ZAP で、約 {short} ZAP 足りません。ZAP が足りるまでは、このサイトからは請求できません。ZAP の入手方法： 42 ファウセットでは 1 ZAP ずつもらえます。42 Chain の取引所（DEX）で買うこともできます。用意できたら「もう一度確認する」を押してください。",
    feeBalanceUnknown: "ZAP の残高を読み取れませんでした。下のボタンでもう一度確認してください。",
    feeQuoteFailed: "ZAP での手数料をいま計算できませんでした。少し待ってから下のボタンでもう一度お試しください。",
    feeCheckAgainBtn: "もう一度確認する",
    feeVerifyBtn: "手数料の支払いを確認する",
    feeBurnRejected: "ウォレットでキャンセルされました。何もバーンされていません — 準備ができたらボタンを押して手数料を払ってください。",
    feeBurnFailed: "バーンが通りませんでした。何も引かれていません。もう一度お試しできます。",
    feeUnconfirmed: "バーンは送信しましたが、まだ確認できていません。下のボタンで再確認してください — 手数料が二重にかかることはありません。",
    faucetLinkText: "42 ファウセットを開く"
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
/* 5% of the estimated claim (preview total), rounded down.
   0 means: no fee is due and the claim is unlocked as-is. */
function computeFeeWei(previewTotalWei) {
  var w = typeof previewTotalWei === "bigint" ? previewTotalWei : BigInt(previewTotalWei);
  if (w <= 0n) return 0n;
  return w * FEE_NUM / FEE_DEN;
}
function encodeTransfer(to, amountWei) {
  return callData(SEL.transfer, encodeAddress(to) + encodeUint(amountWei));
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
/* Stable fingerprint of a Guide id set (order-insensitive): FNV-1a over the
   sorted ids. Stored in the prepaid record so a returning visit can tell
   whether the record was made for the same claim set. */
function idsFingerprint(ids) {
  var sorted = (ids || []).slice().sort(function (a, b) { return a - b; });
  var s = sorted.join(",");
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return ("0000000" + h.toString(16)).slice(-8);
}
/* The part of `unclaimedIds` covered by a verified prepaid record. */
function honoredClaimIds(recordIds, unclaimedIds) {
  if (!Array.isArray(recordIds) || !Array.isArray(unclaimedIds)) return [];
  var set = {};
  recordIds.forEach(function (id) { set[id] = true; });
  return unclaimedIds.filter(function (id) { return !!set[id]; });
}
/* The claim gate. Pure, so the harness can walk every state:
   - "nothing":      no unclaimed Guides.
   - "unlocked":     claim may run for claimIds — either the fee rounds to 0,
                     or a verified prepaid record covers claimIds (never
                     charged twice; quote/balance are not consulted then).
   - "needquote":    fee is due but the ZAP quote could not be read.
   - "insufficient": ZAP balance is below the fee (or unreadable:
                     shortfallWei is null then).
   - "ready":        fee is due and payable; claim stays LOCKED until the
                     burn verifies — claimIds is empty on purpose. */
function computeClaimAccess(args) {
  var unclaimedIds = args.unclaimedIds || [];
  if (unclaimedIds.length === 0) return { status: "nothing", claimIds: [] };
  var feeCatWei = typeof args.feeCatWei === "bigint" ? args.feeCatWei : BigInt(args.feeCatWei || 0);
  if (feeCatWei <= 0n) return { status: "unlocked", claimIds: unclaimedIds.slice(), honored: false, extra: 0 };
  if (args.paidIds) {
    var honored = honoredClaimIds(args.paidIds, unclaimedIds);
    if (honored.length > 0) {
      return { status: "unlocked", claimIds: honored, honored: true, extra: unclaimedIds.length - honored.length };
    }
  }
  if (args.feeZapWei === null || args.feeZapWei === undefined || BigInt(args.feeZapWei) <= 0n) {
    return { status: "needquote", claimIds: [] };
  }
  var feeZapWei = BigInt(args.feeZapWei);
  if (args.zapBalanceWei === null || args.zapBalanceWei === undefined) {
    return { status: "insufficient", claimIds: [], shortfallWei: null };
  }
  var bal = BigInt(args.zapBalanceWei);
  if (bal < feeZapWei) {
    return { status: "insufficient", claimIds: [], shortfallWei: (feeZapWei - bal).toString() };
  }
  return { status: "ready", claimIds: [] };
}
var TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/* Proof a prepaid burn happened: the tx succeeded AND its logs show exactly
   `amountWei` ZAP moving from the user to the burn address. */
function receiptBurnVerified(receipt, userAddress, amountWei) {
  if (!receipt || receipt.status !== "0x1" || !Array.isArray(receipt.logs)) return false;
  var amt;
  try { amt = BigInt(amountWei); } catch (e) { return false; }
  var userTopic = "0x" + encodeAddress(userAddress);
  var burnTopic = "0x" + encodeAddress(BURN_ADDRESS);
  for (var i = 0; i < receipt.logs.length; i++) {
    var log = receipt.logs[i];
    if (!log || !log.address || log.address.toLowerCase() !== ZAP.toLowerCase()) continue;
    if (!log.topics || log.topics.length < 3) continue;
    if (String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    if (String(log.topics[1]).toLowerCase() !== userTopic.toLowerCase()) continue;
    if (String(log.topics[2]).toLowerCase() !== burnTopic.toLowerCase()) continue;
    try { if (BigInt(log.data) === amt) return true; } catch (e) { /* keep checking */ }
  }
  return false;
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
    computeFeeWei: computeFeeWei, encodeTransfer: encodeTransfer,
    encodeGetAmountsOut: encodeGetAmountsOut, decodeAmountsOut: decodeAmountsOut,
    idsFingerprint: idsFingerprint, honoredClaimIds: honoredClaimIds,
    computeClaimAccess: computeClaimAccess, receiptBurnVerified: receiptBurnVerified,
    getErc20Balance: getErc20Balance, getZapBalance: getZapBalance,
    quoteZapOut: quoteZapOut
  };
}

/* ---------- browser UI ---------- */
if (typeof document !== "undefined" && typeof window !== "undefined") {
  (function () {
    var lang = document.documentElement.lang === "ja" ? "ja" : "en";
    var S = I18N[lang];
    function t(key, vars) { return template(S[key] || key, vars); }
    function $(id) { return document.getElementById(id); }

    var state = {
      address: null, scan: null, claiming: false, feeRunning: false,
      access: null, feeCatWei: 0n, feeZapWei: null, zapBalance: null,
      feeAction: null, feeFlash: null, lastFee: null
    };

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

    /* Counts + estimated total — the only scan numbers shown before the
       fee gate opens. */
    function renderHeader(scan) {
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
    }

    /* Information gating: which Guides are unclaimed (ids, tiers, per-Guide
       amounts) is the scan work the fee pays for, so the lists are rendered
       ONLY once the gate is unlocked (fee verified / not due) or right after
       a claim. Before that, no list DOM is built at all. */
    function hideLists(scan) {
      $("unclaimedTitle").hidden = true;
      $("unclaimedList").innerHTML = "";
      $("claimedDetails").hidden = true;
      var el = $("emptyListText");
      if (scan.ownedIds.length === 0) { el.hidden = false; el.textContent = S.noGuides; }
      else if (scan.unclaimed.length === 0) { el.hidden = false; el.textContent = S.emptyList; }
      else { el.hidden = true; }
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

    async function renderScan(scan) {
      state.scan = scan;
      renderHeader(scan);
      hideLists(scan);
      await evaluateFee(scan);
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
        await renderScan(scan);
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

    /* ---------- site fee: prepaid in ZAP, before the claim ----------
       The claim stays locked until a ZAP burn worth 5% of the estimated
       claim (preview total, at the live quote) is verified from its
       receipt — inside the site flow there is no claim-first-dodge-later
       gap. A minimal record in localStorage makes a burn that already
       happened binding on return visits: it is verified from the receipt,
       never re-sent, and the ids it covered are never charged twice. */
    function loadPrepaid() {
      try { localStorage.removeItem(LEGACY_PENDING_FEE_KEY); } catch (e) {}
      try {
        var raw = localStorage.getItem(PENDING_FEE_KEY);
        if (!raw) return null;
        var r = JSON.parse(raw);
        if (!r || r.v !== 2 || !r.address || !Array.isArray(r.ids) || !r.feeZapWei || !r.stage) return null;
        return r;
      } catch (e) { return null; }
    }
    function savePrepaid(r) {
      try { localStorage.setItem(PENDING_FEE_KEY, JSON.stringify(r)); } catch (e) {}
    }
    function clearPrepaid() {
      try { localStorage.removeItem(PENDING_FEE_KEY); } catch (e) {}
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
    function setFeeProgress(msg) { var el = $("feeProgress"); if (el) el.textContent = msg || ""; }
    function feePanelMessage(kind, msg, hash) {
      var box = $("feeResult");
      if (!box) return;
      box.innerHTML = "";
      box.className = "result" + (kind ? " " + kind : "");
      var d = document.createElement("div");
      d.textContent = msg;
      box.appendChild(d);
      if (hash) box.appendChild(txLinkDiv(hash));
    }

    /* Work out the claim gate for this scan and render it: prepaid record
       first (a verified burn is honored without consulting quote/balance),
       then the live quote, then the ZAP balance. */
    async function evaluateFee(scan) {
      var ids = scan.unclaimed.map(function (u) { return u.id; });
      var feeCatWei = computeFeeWei(BigInt(scan.totalPreviewWei));
      state.feeCatWei = feeCatWei;
      state.feeZapWei = null;
      state.zapBalance = null;
      state.access = null;
      state.lastFee = null;
      var record = loadPrepaid();
      if (!record || !state.address || record.address.toLowerCase() !== state.address.toLowerCase()) record = null;
      var paidIds = null;
      if (record && record.stage === "paid") {
        paidIds = record.ids;
      } else if (record && record.stage === "burnsent" && record.burnTx) {
        /* A burn was sent but never verified here — check its receipt
           before anything else. It is never re-sent. */
        var receipt = await getReceiptViaWallet(record.burnTx);
        if (receipt && receipt.status === "0x1" && receiptBurnVerified(receipt, state.address, record.feeZapWei)) {
          record.stage = "paid";
          savePrepaid(record);
          paidIds = record.ids;
        } else if (receipt && receipt.status !== "0x1") {
          /* The burn tx failed on-chain: nothing was charged, so the
             stale record can go and the fee is evaluated fresh. */
          clearPrepaid();
          record = null;
        } else {
          state.feeCatWei = BigInt(record.feeCatWei || "0");
          state.feeZapWei = BigInt(record.feeZapWei);
          state.access = { status: "verifying", claimIds: [] };
          renderGate(scan);
          return;
        }
      }
      if (ids.length > 0 && feeCatWei > 0n && !paidIds) {
        try { state.feeZapWei = await quoteZapOut(feeCatWei); } catch (e) { state.feeZapWei = null; }
        if (state.feeZapWei !== null) {
          state.zapBalance = await getZapBalance(state.address).catch(function () { return null; });
        }
      }
      state.access = computeClaimAccess({
        unclaimedIds: ids, feeCatWei: feeCatWei,
        feeZapWei: state.feeZapWei, zapBalanceWei: state.zapBalance,
        paidIds: paidIds
      });
      if (state.access.status === "unlocked" && state.access.honored && record) {
        state.lastFee = {
          feeCatWei: BigInt(record.feeCatWei || "0"),
          feeZapWei: BigInt(record.feeZapWei),
          burnTx: record.burnTx
        };
      }
      if (record && record.stage === "paid" && !(state.access.status === "unlocked" && state.access.honored)) {
        /* The prepaid set is fully claimed or disjoint from this scan —
           the record is spent; any new set is evaluated (and charged) on
           its own, never as a second charge for the same ids. */
        clearPrepaid();
      }
      renderGate(scan);
    }

    function renderGate(scan) {
      var access = state.access || { status: "nothing", claimIds: [] };
      var feeEl = $("feeEstimate");
      var panel = $("feePanel");
      var title = $("feePendingTitle");
      var text = $("feePendingText");
      var btn = $("feeResumeBtn");
      var claimBtn = $("claimBtn");
      var feeCatWei = state.feeCatWei || 0n;
      var feeZapWei = state.feeZapWei;

      if (scan.unclaimed.length === 0) {
        claimBtn.disabled = true;
        claimBtn.textContent = S.claimBtnNone;
      } else if (access.status === "unlocked") {
        claimBtn.disabled = false;
        claimBtn.textContent = S.claimBtn + " (" + access.claimIds.length + ")";
      } else {
        claimBtn.disabled = true;
        claimBtn.textContent = S.claimBtnLocked;
      }

      if (scan.unclaimed.length === 0) feeEl.textContent = "";
      else if (access.status === "unlocked" && access.honored) {
        var hn = t("feeHonoredNote", { n: access.claimIds.length });
        if (access.extra > 0) hn += t("feeHonoredExtra", { extra: access.extra });
        feeEl.textContent = hn;
      }
      else if (feeCatWei <= 0n) feeEl.textContent = S.feeZeroNote;
      else if (feeZapWei !== null && feeZapWei > 0n) feeEl.textContent = t("feeEstimate", { fee: formatCAT(feeCatWei), zap: formatCAT(feeZapWei) });
      else feeEl.textContent = t("feeEstimateNoZap", { fee: formatCAT(feeCatWei) });

      /* The list is revealed only behind the open gate; a scan with nothing
         unclaimed left (e.g. right after a claim) shows the claimed list. */
      if (access.status === "unlocked" || scan.unclaimed.length === 0) revealLists(scan);
      else hideLists(scan);

      var box = $("feeResult");
      box.innerHTML = "";
      setFeeProgress("");
      title.textContent = S.feePendingTitle;
      if (state.feeFlash && access.status === "unlocked") {
        panel.hidden = false;
        text.textContent = "";
        btn.hidden = true;
        state.feeAction = null;
        feePanelMessage(state.feeFlash.kind, state.feeFlash.msg, state.feeFlash.hash);
        state.feeFlash = null;
      } else if (access.status === "ready") {
        panel.hidden = false;
        text.textContent = t("feeReadyText", { zap: formatCAT(feeZapWei) });
        btn.hidden = false;
        btn.textContent = t("feeBurnBtn", { zap: formatCAT(feeZapWei) });
        state.feeAction = "burn";
      } else if (access.status === "insufficient") {
        panel.hidden = false;
        btn.hidden = false;
        btn.textContent = S.feeCheckAgainBtn;
        state.feeAction = "recheck";
        if (access.shortfallWei === null || access.shortfallWei === undefined) {
          text.textContent = S.feeBalanceUnknown;
        } else {
          text.textContent = t("feeShortfall", {
            zap: formatCAT(feeZapWei),
            bal: formatCAT(state.zapBalance || 0n),
            short: formatCAT(BigInt(access.shortfallWei))
          });
          var fl = document.createElement("div");
          var fa = document.createElement("a");
          fa.href = "https://ql1-infinite42-guppy-histoire.github.io/42-faucet/";
          fa.target = "_blank"; fa.rel = "noreferrer";
          fa.textContent = S.faucetLinkText;
          fl.appendChild(fa);
          box.appendChild(fl);
        }
      } else if (access.status === "needquote") {
        panel.hidden = false;
        text.textContent = S.feeQuoteFailed;
        btn.hidden = false;
        btn.textContent = S.feeCheckAgainBtn;
        state.feeAction = "recheck";
      } else if (access.status === "verifying") {
        panel.hidden = false;
        text.textContent = S.feeUnconfirmed;
        btn.hidden = false;
        btn.textContent = S.feeVerifyBtn;
        state.feeAction = "verify";
      } else {
        panel.hidden = true;
        state.feeAction = null;
      }
    }

    /* Pay the fee: ONE ZAP transfer to the burn address. The hash is
       recorded the moment it exists, so a closed tab mid-wait still
       resumes as verify-only. On a verified burn the claim starts right
       away, keeping the abandon window as small as possible. */
    async function payFee() {
      if (state.feeRunning || !state.address || !state.scan) return;
      var scan = state.scan;
      var ids = scan.unclaimed.map(function (u) { return u.id; });
      var feeCatWei = computeFeeWei(BigInt(scan.totalPreviewWei));
      if (ids.length === 0 || feeCatWei <= 0n) return;
      state.feeRunning = true;
      $("feeResumeBtn").hidden = true;
      $("feeResult").innerHTML = "";
      try {
        try { await ensureChain(); } catch (e) { /* the wallet will surface it on send */ }
        /* Fresh amounts at pay time: the ZAP conversion (and the balance)
           may have moved since the scan. The fee itself stays 5% of the
           scanned estimate, as disclosed. */
        var feeZapWei = await quoteZapOut(feeCatWei);
        if (feeZapWei === null || feeZapWei <= 0n) {
          feePanelMessage("error", S.feeQuoteFailed);
          $("feeResumeBtn").hidden = false;
          return;
        }
        var bal = await getZapBalance(state.address).catch(function () { return null; });
        if (bal === null || bal < feeZapWei) {
          /* Fell short since the scan — re-render the gate honestly. */
          state.feeZapWei = feeZapWei;
          state.zapBalance = bal;
          state.access = computeClaimAccess({
            unclaimedIds: ids, feeCatWei: feeCatWei,
            feeZapWei: feeZapWei, zapBalanceWei: bal, paidIds: null
          });
          renderGate(scan);
          return;
        }
        var record = {
          v: 2, address: state.address, ids: ids,
          fingerprint: idsFingerprint(ids),
          feeCatWei: feeCatWei.toString(), feeZapWei: feeZapWei.toString(),
          burnTx: null, stage: "burnsent", createdAt: Date.now()
        };
        var sent = await sendWalletTx(ZAP, encodeTransfer(BURN_ADDRESS, feeZapWei), S.feePayStep);
        record.burnTx = sent.hash;
        savePrepaid(record);
        if (!sent.receipt) {
          feePanelMessage("error", S.feeUnconfirmed, sent.hash);
          var b1 = $("feeResumeBtn");
          b1.hidden = false; b1.textContent = S.feeVerifyBtn; state.feeAction = "verify";
          return;
        }
        if (sent.receipt.status !== "0x1") {
          /* Failed burn: nothing was charged; drop the record and let the
             gate offer a fresh try. */
          clearPrepaid();
          state.feeZapWei = feeZapWei;
          state.zapBalance = bal;
          state.access = computeClaimAccess({
            unclaimedIds: ids, feeCatWei: feeCatWei,
            feeZapWei: feeZapWei, zapBalanceWei: bal, paidIds: null
          });
          renderGate(scan);
          feePanelMessage("error", S.feeBurnFailed, sent.hash);
          return;
        }
        if (!receiptBurnVerified(sent.receipt, state.address, feeZapWei)) {
          /* Succeeded but the burn did not check out — never resend;
             leave the record for verification. */
          feePanelMessage("error", S.feeUnconfirmed, sent.hash);
          var b2 = $("feeResumeBtn");
          b2.hidden = false; b2.textContent = S.feeVerifyBtn; state.feeAction = "verify";
          return;
        }
        record.stage = "paid";
        savePrepaid(record);
        state.lastFee = { feeCatWei: feeCatWei, feeZapWei: feeZapWei, burnTx: sent.hash };
        state.feeZapWei = feeZapWei;
        state.access = computeClaimAccess({
          unclaimedIds: ids, feeCatWei: feeCatWei,
          feeZapWei: null, zapBalanceWei: null, paidIds: ids
        });
        state.feeFlash = {
          kind: "ok",
          msg: t("feePaidNote", { fee: formatCAT(feeCatWei), zap: formatCAT(feeZapWei) }),
          hash: sent.hash
        };
        renderGate(scan);
        /* Minimize the abandon window: start the claim right away. */
        await claimAll();
      } catch (e) {
        setFeeProgress("");
        if (e && e.code === 4001) feePanelMessage("error", S.feeBurnRejected, e.hash);
        else feePanelMessage("error", S.feeBurnFailed, e && e.hash);
        var btn = $("feeResumeBtn");
        btn.hidden = false;
        if (state.feeAction === "burn" && state.feeZapWei) {
          btn.textContent = t("feeBurnBtn", { zap: formatCAT(state.feeZapWei) });
        }
      } finally {
        state.feeRunning = false;
      }
    }

    /* Resume path for a burn that was sent but not yet verified here:
       verify-only from the receipt. Never re-sends, never re-charges. */
    async function verifyPendingBurn() {
      if (state.feeRunning || !state.address) return;
      var record = loadPrepaid();
      if (!record || record.address.toLowerCase() !== state.address.toLowerCase() || !record.burnTx) return;
      state.feeRunning = true;
      $("feeResumeBtn").hidden = true;
      try {
        var receipt = await getReceiptViaWallet(record.burnTx);
        if (receipt && receipt.status === "0x1" && receiptBurnVerified(receipt, state.address, record.feeZapWei)) {
          record.stage = "paid";
          savePrepaid(record);
          state.feeFlash = {
            kind: "ok",
            msg: t("feePaidNote", { fee: formatCAT(BigInt(record.feeCatWei || "0")), zap: formatCAT(BigInt(record.feeZapWei)) }),
            hash: record.burnTx
          };
          await scanAndRender();
          return;
        }
        if (receipt && receipt.status !== "0x1") {
          /* The recorded burn failed on-chain: nothing was charged. */
          clearPrepaid();
          await scanAndRender();
          return;
        }
        feePanelMessage("error", S.feeUnconfirmed, record.burnTx);
        var b = $("feeResumeBtn");
        b.hidden = false; b.textContent = S.feeVerifyBtn; state.feeAction = "verify";
      } finally {
        state.feeRunning = false;
      }
    }

    function onFeeAction() {
      if (state.feeAction === "burn") payFee();
      else if (state.feeAction === "verify") verifyPendingBurn();
      else scanAndRender(); /* recheck: fresh scan, quote and balance */
    }

    async function claimAll() {
      /* The claim only ever runs behind a satisfied fee gate, for exactly
         the ids the gate unlocked. */
      if (state.claiming || !state.scan) return;
      if (!state.access || state.access.status !== "unlocked" || state.access.claimIds.length === 0) {
        if (state.scan.unclaimed.length === 0) setResult($("claimResult"), S.nothingToClaim, "error");
        return;
      }
      state.claiming = true;
      $("claimBtn").disabled = true;
      setResult($("claimResult"), "");
      var ids = state.access.claimIds.slice();
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
        /* The prepaid fee covered exactly these ids and is now spent, so
           the record goes away. (If a chunk failed above we never reach
           here — the record stays, and the rest can be claimed later
           without paying again.) */
        var feeSnapshot = state.lastFee;
        clearPrepaid();
        state.lastFee = null;
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
        if (feeSnapshot) {
          var fl = document.createElement("div");
          fl.textContent = t("feePaidLine", { fee: formatCAT(feeSnapshot.feeCatWei), zap: formatCAT(feeSnapshot.feeZapWei) });
          box.appendChild(fl);
          if (feeSnapshot.burnTx) box.appendChild(txLinkDiv(feeSnapshot.burnTx));
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
        if (state.access && state.access.status === "unlocked") $("claimBtn").disabled = false;
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
    $("feeResumeBtn").addEventListener("click", function () { onFeeAction(); });
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
          state.address = null; state.scan = null; state.access = null; state.lastFee = null; state.feeAction = null; state.feeFlash = null;
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

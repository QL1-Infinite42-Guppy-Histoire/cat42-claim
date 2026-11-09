# CAT42 請求サイト（Guide 保有者向け）

42 Chain 上の NFT「The Guide」を持っている人が、まだ請求していない CAT42 を
**ワンタップでまとめて受け取れる**、初心者向けの静的サイトです。

- ウォレット（MetaMask など）をつなぐ
- 保有している Guide を自動で探す
- サイト手数料（見込み額の 5% 相当の ZAP）をバーンすると、そのまま請求が始まる
  （CAT42 コントラクトの `claimMany` を使用。手数料の詳細は下記）

専門用語は画面に出さず、日常の言葉だけで案内します。スマホ（Android）での利用を前提に、
大きなボタンと読みやすいカード型レイアウトにしています。

公開ページは `docs/` 配下です（言語ゲート `index.html` → 英語が既定、`ja.html` が日本語）。

## 請求の仕組み（コントラクトの実動作）

- Guide 1つにつき、CAT42 を請求できるのは **1回だけ** です。請求済みの Guide は二度と請求できません。
- もらえる量は、その時点の共有プール（ボールト）残高 × 0.02% × ティア倍率 で決まります。
  請求のたびに同じ量がバーン（焼却）されるため、**まとめて請求すると、後ろの Guide ほど
  少しずつもらえる量が減ります**。サイトの表示は「いま請求した場合の目安」です。
- プール自体も毎日少しずつ減っていきます（`ratePerDay` 0.1%〜0.4%）。急ぐ必要はありませんが、
  表示額は将来も同じとは限りません。

### ティア倍率

| ティア | 名前 | 倍率 | 目安（2026-11-07 実測） |
|---|---|---|---|
| 0 | Common | ×1 | 約 374 CAT42 |
| 1 | Rare | ×2 | 約 748 CAT42 |
| 2 | Epic | ×4 | 約 1,496 CAT42 |
| 3 | Legendary | ×8 | 約 2,993 CAT42 |

## サイト手数料（請求の前に ZAP で前払い・バーン）

このサイトから請求するには、**請求の前に** サイト手数料を ZAP で払います
（2026-11-09 のユーザー決定：ZAP 前払いのみ。当初案の「請求後に CAT42 を交換して
バーン」は、承認を拒否すれば回避できる抜け道があったため廃止）。

- 手数料は **請求見込み額（未請求 Guide の preview 合計）の 5%**（切り捨て）を、
  その時点の CAT42/ZAP レート（ルーターの `getAmountsOut`）で ZAP に換算した量です。
  切り捨てで 0 になる場合は手数料なしで、そのまま請求できます。
- **順番が要です**: 請求ボタンは、バーンがレシートで検証できるまでロックされたままです。
  ユーザーがウォレットで確認するのは **ZAP をバーンアドレス
  `0x000000000000000000000000000000000000dEaD` へ送る 1 回の送金だけ**（42 ファウセットの
  ZAP バーンと同じ方式）。バーンが確認できた直後に請求が自動で始まるので、
  「払ったのに請求しないまま離脱する」窓も最小にしています。サイトの流れの中では
  「先に請求して手数料だけ回避する」隙間はありません。
- **情報のゲーティング**: 手数料を払う前に見えるのは、スキャンの進捗・件数・
  **見込み合計（Σ preview）と手数料** だけです。どの Guide が未請求か（ID・ティア・
  個別の見込み額）は、バーンの検証が済むまで画面に出しません（DOM 自体を作りません）。
  このサイトのスキャンこそが対価の対象であり、一覧を先に見せると、それを持って
  コントラクトを直接叩き、手数料を回避できてしまうためです。
- **ZAP が足りない場合**: サイトからは先へ進めません。不足量を表示し、入手方法を
  案内します（42 ファウセットで 1 ZAP ずつもらえる／DEX で買える）。他の方法への
  黙ったフォールバックはしません。
- **開示（バーンの前に、細字ではなく大きく）**:
  (1) 手数料は **見込み額** から計算します。実際の受取額は、請求の中で Guide ごとに
  少しずつ減るため、表示と少し違うことがあります。
  (2) 前払いした ZAP はバーンされるため、**あとで請求をやめても、請求が通らなくても、
  戻ってきません**。
- **再開と二重請求の防止**: バーンを送った時点で、最小限の記録（アドレス・対象 Guide の
  ID 集合と指紋・feeZAP・バーン tx・段階）を localStorage に残します。タブを閉じても、
  同じウォレットで戻ればバーンはレシートから検証だけを行い（**再送はしません**）、
  請求ステップから再開できます。対象 ID の一部が他で請求済みになっていた場合は、
  残りの ID に対して支払い済み記録をそのまま認め、**同じ ID に二重に請求しません**。
- **正直な注記**: これは **サイト利用料** です。CAT42 コントラクトの `claimMany` は
  誰でも直接呼べるため、サイトを通さない請求には手数料はかかりません（請求は Guide
  保有者本人しか呼べない設計上、請求を肩代わりして強制する作りにはできません）。
  また、ZAP を持っていない人は、まず ZAP を用意する必要があります。

関連アドレス: ZAP `0x89195Ca5C954b6f99b78f4A2Aa5435A75Dc5B256` /
Infinite ルーター `0xBF07dFE35746894bAe373f63f4Bf2379F9BaFEc0` /
CAT42/ZAP ペア `0xc6386fcca45591e604edc3f512465d0ebad79944`
（2026-11-09 実測: 準備高 約 5.07M CAT42 / 約 12,284 ZAP、400 CAT42 → 約 0.9653 ZAP）。

## コントラクト（42 Chain、EVM チェーンID 421018）

| 対象 | アドレス |
|---|---|
| CAT42（"Cat 42"、18 decimals、検証済みソース） | `0x7386719EBbBeB4d810fF89027Bfb8A1CDf696310` |
| Guide NFT（"The Guide"、ERC-721） | `0xF349E469C474048DEd6F9b914309E76880ED1bbD` |

- エクスプローラー: https://scan.infinitedrive.xyz
- CAT42 アイコン: https://raw.githubusercontent.com/maze369/token-icons/main/icons/0x7386719ebbbeb4d810ff89027bfb8a1cdf696310.jpg
  （読み込めない場合は 🐱 で代替表示します）

## 技術メモ

- **ライブラリ不使用**: 素の JavaScript + `fetch` + `window.ethereum` のみ。calldata は手組み、
  ビルド工程なし。
- **保有 Guide の探索**: Guide の `nextId()` を読み、`ownerOf(1..nextId-1)` を
  JSON-RPC バッチ（100件/リクエスト、最大4並列）で走査します。進捗を数字で表示し、
  見つけた件数は `balanceOf(address)` と照合します（食い違う場合は画面で正直に知らせます）。
  その後 `claimed()` で請求済みを分け、未請求分だけ `preview()` と `tier()` をバッチで読みます。
- **請求**: 未請求が100件以下なら `claimMany` 1回。100件超は100件ずつに分けて順番に送信します
  （各回ウォレット確認あり、進捗を表示）。ガスは `eth_estimateGas` の実測 + 20% バッファ。
  受け取り額は、送信前後の CAT42 残高の差分として表示します（読めない場合は金額を出さず
  「完了」とだけ表示します）。請求は手数料ゲート（`computeClaimAccess`）が unlocked の
  ときだけ、そのゲートが解放した ID 集合に対して実行されます。
- **手数料（前払い）**: スキャン後に preview 合計の 5% を CAT42 相当とし、ルーター見積もり
  （`getAmountsOut` を RPC 読み）で ZAP に換算。ZAP 残高が足りればバーン送金 1 回
  （`transfer` の calldata も手組み）→ レシートの Transfer ログ（本人 → バーンアドレス、
  金額一致）で検証 → 請求を自動開始。状態は localStorage の `cat42claim_prepaid_fee_v2`
  に最小限だけ保存し、再開時は「バーン済みなら検証のみ・再送なし」「支払い済み記録は
  残り ID にそのまま適用」という冪等な作りにしています。旧設計（請求後スワップ方式）の
  `cat42claim_pending_fee_v1` 記録は無視して消去します。ゲート判定・指紋・検証は純粋関数
  （`computeClaimAccess` / `idsFingerprint` / `honoredClaimIds` / `receiptBurnVerified`）
  に切り出し、`tools/verify.js` で全状態を検証しています。
- **RPC**: `https://evm-rpc.infinitepanda.xyz`（主）/ `https://evm-rpc-infinite.mschihuahua.org`（予備）。
  読み取りはウォレット不要で、接続前でも全体統計（請求総数・プール残高・Guide 発行数）を表示します。
- **チェーン切替**: 421018 でない場合は `wallet_switchEthereumChain`、未登録（4902）なら
  `wallet_addEthereumChain` で追加します。拒否（4001）はエラー表示ではなく、やさしい案内にします。
- 秘密鍵・復旧フレーズを扱うことは一切ありません。

### 検証（2026-11-07、ローカル実測）

`tools/verify.js` が `docs/app.js` と**同じ**スキャン関数を Node から実行し、実チェーンで確認しました:

- 全体: 請求総数 4,000 / プール残高 約 1,870,387 CAT42 / Guide 発行 4,318
- `0x0E2E…92B0`: 走査で見つけた保有数 **733** = `balanceOf` **733**（請求済み 717 / 未請求 16、見込み合計 約 11,596 CAT42）
- `0x7a8C…9fb4`: Guide #32（Common、約374）/ #36（Epic、約1,496）/ #73 / #79 / #86 が
  「保有・未請求・preview > 0」で正しく検出
- `claimMany([4250, 4251])` の calldata がセレクタ `0x925489a8`・オフセット `0x20`・長さ 2 で
  正しく往復することを単体確認

実際の請求トランザクションは送信していません（検証は読み取りのみ）。

### 検証（2026-11-09 追加、前払い ZAP 手数料）

当初案（請求後に CAT42 をスワップしてバーン）は同日に前払い方式へ設計変更。
`tools/verify.js` の手数料まわりの確認を新しい設計に合わせて全て合格（全 86 項目）:

- 手数料計算: preview 合計からの 5%・切り捨て・0 のケース（19 wei → 0）・文字列 wei の
  受け付け・複数 Guide の preview 合計からの計算
- calldata 往復: バーン送金 `transfer`（バーン先/金額、手数料サイズの金額も）/ `getAmountsOut`
- ルーター見積もり（ライブ読み取り）: 400 CAT42 → 約 0.9653 ZAP、見込み 400 CAT42 の
  手数料 20 CAT42 → 約 0.0483 ZAP（想定レートの範囲内）
- ID 集合の指紋（順不同で安定）と、支払い済み記録と未請求集合の積集合（再開時の適用範囲）
- ゲート状態の全分岐: バーン検証なし（または 0 円でない手数料）では請求に到達できないこと、
  残高不足は不足額つき insufficient、支払い済み記録は見積もり・残高を読まずに解放し
  二重請求にならないこと、記録と無関係な新しい集合は解放しないこと
- レシートによるバーン検証: 金額・宛先・送信者・成功ステータスのいずれが欠けても不可
- EN/JA 両シェルに手数料 UI の要素と両言語の開示文言（前払い・見込み計算・返金不可）が
  あること、`app.js?v=3` の読み込み、スワップ方式のコードが残っていないこと

実際の請求＋手数料の送信はこの環境からは行っていません。**最初の実請求＋手数料の
一連の流れが、エンドツーエンドの最終確認**になります。

## ローカルで動かす

```sh
cd docs && python3 -m http.server 8000
# http://localhost:8000/ を開く（index.html が言語ゲート）
```

検証ハーネス:

```sh
node tools/verify.js
```

## English summary

A beginner-friendly static site for Guide NFT holders on 42 Chain (chain ID 421018)
to claim their unclaimed CAT42 in one tap. Connect an EVM wallet, the site batch-scans
`ownerOf` over all issued Guides, cross-checks the count against `balanceOf`, reads
`claimed()` / `preview()` / `tier()` for what you hold, and claims everything at once
via CAT42's `claimMany` (chunked at 100 IDs, gas estimated per chunk with a 20% buffer).
Each Guide can claim exactly once; the payout is the current vault × 0.02% × tier
multiplier (Common ×1, Rare ×2, Epic ×4, Legendary ×8), the same amount is burned per
claim, and the vault decays daily — so displayed amounts are "if you claim now"
estimates. Vanilla JS only, no libraries, no build step. Verified against the live
chain on 2026-11-07 with `tools/verify.js` (read-only; no claim was sent). MIT license.

**Site fee (prepaid ZAP, redesigned 2026-11-09):** the fee is paid BEFORE the
claim, in ZAP only — 5% of the estimated claim (the sum of `preview()` over the
Guides to be claimed, rounded down; no fee if it rounds to 0), converted at the
live CAT42/ZAP router quote, burned in a single `transfer` to `0x000…dEaD`. The
claim button stays locked until the burn is verified from its receipt (exact
ZAP Transfer from the user to the burn address), so inside the site flow there
is no claim-first-dodge-later gap — the earlier post-claim swap design had
exactly that loophole (reject the approval, keep everything) and was replaced.
Until the burn verifies, the UI shows only the scan progress, counts, the
estimated total and the fee — never which Guides are unclaimed (no ids, tiers
or per-Guide amounts are rendered), because the scan is the work being paid
for: revealing the list first would let a user take it and claim directly.
Disclosed up front, in plain words (EN/JA): the fee is computed from estimates
(actual payouts decay inside `claimMany`), and a prepaid burn cannot be
refunded even if the claim is then cancelled or fails — the claim therefore
auto-starts the moment the burn confirms. If the user's ZAP balance is short,
the site stops there with the shortfall and honest guidance (42 faucet: 1 ZAP
per claim; or buy ZAP on the DEX) — there is no silent fallback route. A
minimal localStorage record (address, id set + fingerprint, feeZAP, burn tx,
stage) makes a sent burn binding on return: it is verified from the receipt,
never re-sent, and if some of its Guides were claimed elsewhere meanwhile the
record is honored for the remaining ids — the same ids are never charged
twice. It remains a site-usage fee: `claimMany` is permissionless, so claiming
directly against the contract does not pass through this site and carries no
fee, and users without ZAP must obtain some first. Fee checks in
`tools/verify.js` were rewritten for this design and pass (86 checks); no real
claim+fee run has been sent yet — the first user run is the end-to-end check.

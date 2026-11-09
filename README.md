# CAT42 請求サイト（Guide 保有者向け）

42 Chain 上の NFT「The Guide」を持っている人が、まだ請求していない CAT42 を
**ワンタップでまとめて受け取れる**、初心者向けの静的サイトです。

- ウォレット（MetaMask など）をつなぐ
- 保有している Guide を自動で探す
- 「まとめて全部もらう」ボタンを1回押すだけ（CAT42 コントラクトの `claimMany` を使用）

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

## サイト手数料（請求額の 5% を ZAP にしてバーン）

このサイトから請求すると、請求の直後に **サイト手数料** のステップが同じ流れで続きます
（2026-11-09 のユーザー決定：案2・5%）。

- 手数料は **実際に受け取った CAT42 の 5%**（実測の残高差分ベース。プレビュー合計では
  ありません — `claimMany` の中でも受取額は減っていくため）。切り捨てで 0 になる場合は
  手数料なしで、その旨を画面に表示します。
- 手順は各ステップをウォレットで確認しながら進みます:
  1. CAT42 を Infinite ルーターへ承認（既存の承認で足りる場合は省略）
  2. 手数料分の CAT42 を CAT42/ZAP プールで ZAP にスワップ（直前の見積もりから
     スリッページ許容 2% で下限を設定、期限 10 分）。受け取った ZAP は残高差分で実測
     （読めない場合はレシートの Transfer ログで代替）
  3. 受け取った ZAP を **全額** バーンアドレス `0x000000000000000000000000000000000000dEaD`
     へ送金（42 ファウセットの ZAP バーンと同じ方式）
- **開示は事前に大きく**: 請求ボタンの上のサマリーに、手数料の説明と見積もり
  （手数料 CAT42 量＋見積もり時点の ZAP 量）を EN/JA 両方で表示します。完了画面には
  「受け取った CAT42 / 手数料 CAT42 / バーンした ZAP」と各 tx の記録リンクが出ます。
- **中断しても再開できます**: ウォレットで拒否（4001）したり途中でページを閉じても、
  請求自体は完了したまま。未完了の手数料は最小限の記録（アドレス・手数料 CAT42・段階）
  を localStorage に残し、同じウォレットで再訪すると「手数料の続きをする」ボタンで
  再開できます。バーン送信後は再送せず、確認だけを行います。バーン tx の成功に加え、
  「ZAP がユーザーからバーンアドレスへ動いたログ」または「ZAP 残高の減少が金額と一致」
  を確認できるまで、手数料を「完了」とは表示しません。
- **正直な注記**: これは **サイト利用料** です。CAT42 コントラクトの `claimMany` は
  誰でも直接呼べるため、サイトを通さない請求には手数料はかかりません（請求は Guide
  保有者本人しか呼べない設計上、請求を肩代わりして強制する作りにはできません）。
  サイトを使う人は、事前表示を見て納得したうえで手数料ステップに進む形です。

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
  「完了」とだけ表示します。その場合、手数料も測れないので取りません）。
- **手数料フェーズ**: 請求成功の直後に上記「サイト手数料」の承認→スワップ→バーンを
  続けて実行します（`approve` / `swapExactTokensForTokens` / `transfer` の calldata も手組み、
  ルーター見積もりは `getAmountsOut` を RPC 読み）。状態は localStorage の
  `cat42claim_pending_fee_v1` に最小限だけ保存し、再開時は段階に応じて
  「承認済みか再読 → スワップ未送信なら送信（送信済みならレシート確認）→ バーンは
  再送せず検証のみ」という冪等な作りにしています。
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

### 検証（2026-11-09 追加、手数料フェーズ）

`tools/verify.js` に手数料まわりの確認を追加し、全て合格:

- 手数料計算: 5%・切り捨て・0 のケース（19 wei → 0）・文字列 wei の受け付け
- calldata 往復: `approve`（spender/金額）/ `transfer`（バーン先/金額）/
  `swapExactTokensForTokens`（path オフセット 160・CAT42→ZAP・期限）/ `getAmountsOut`
- ルーター見積もり（ライブ読み取り）: 400 CAT42 → 約 0.9653 ZAP（想定レートの範囲内）
- レシートログ解析（ZAP 受取の代替測定）が ZAP 以外・宛先違いを数えないこと
- EN/JA 両シェルに手数料 UI の要素と両言語の手数料文言があること、`app.js?v=2` の読み込み

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

**Site fee (added 2026-11-09):** claiming through this site continues, in the same
flow, into a fee phase — 5% of the CAT42 actually received (measured balance diff,
rounded down; skipped if it rounds to 0) is swapped into ZAP on the CAT42/ZAP pool
and all of that ZAP is burned to `0x000…dEaD`. The fee is disclosed in the summary
above the claim button with live estimates (EN/JA), the completion screen shows
received / fee / burned amounts with explorer links, and an interrupted fee phase
persists a minimal localStorage record so it can be resumed with the same wallet
(the burn is never re-sent, only verified). It is a site-usage fee: `claimMany`
is permissionless, so claiming directly against the contract does not pass through
this site and carries no fee. Fee checks were added to `tools/verify.js` and pass;
no real claim+fee run has been sent yet — the first user run is the end-to-end check.

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
  「完了」とだけ表示します）。
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

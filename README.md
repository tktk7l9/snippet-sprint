# Snippet Sprint — Code Typing Trainer

**[▶ Play Now](https://snippet-sprint.saitotakuya0719.workers.dev)**

表示された実コードのスニペットを1問ずつ正確に打って、プログラミングのタイピング（記号・camelCase・インデント・実コードの流れ）を上達させるための Three.js 製タイピングゲーム。コード文字は鮮明な DOM、その背後で WebGL のネオンステージ（パーティクル / ブルーム / コンボ閃光 / ミス時シェイク）が入力にリアルタイムで反応する。

## 特徴

- **strict モード** — 表示されたコードを左から1文字ずつ。正しい文字だけが先に進み、誤打はミスとして記録される。
- **29 言語・計 491 問** — TS/JS・Python・Go・Rust・Java・C++・C・Zig・C#・Swift・Kotlin・Dart・Scala・Ruby・PHP・SQL・R・Julia・Bash・Perl・Lua・Elixir・Haskell・Erlang・OCaml・F#・HTML・CSS の頻出パターン（基本構文・関数・制御フロー・非同期）、二分探索・クイックソート・DP・Kadane・DFS・挿入ソート・連結リスト反転・マージソート・繰り返し二乗法・Fisher–Yates シャッフル・ブートストラップ法・シュワルツ変換・ランレングス符号化・二分探索木への挿入・ニュートン法・順列の列挙・ハノイの塔・素因数分解などの有名アルゴリズム、`=> === && || {} []` や正規表現・クォート・ラムダ・ビット演算・エスケープ・書式指定子などの記号ドリル。デフォルトは TS/JS のみ選択（スタート画面で自由に増減）。
- **言語別テーマ背景** — いま打っている言語のブランドカラーに、WebGL 背景（星雲・トンネル・コア・フォグ）と画面のグラデーションがスムーズに変化（TS=青 / Python=青+黄 / Go=シアン / Rust=オレンジ / C=グレーブルー / Zig=アンバー / Ruby=赤 / Swift=橙 / Kotlin=紫 / Dart=青+水色 / R=青+グレー / Julia=緑+紫 / Lua=紺 / Elixir=紫+ラベンダー / Erlang=赤 / OCaml=オレンジ / F#=青+水色 / Bash=ターミナル緑 など）。
- **弱点分析** — クリア後に WPM・正確率・スコア・ランク（S〜D）と、どの記号でつまずいたかを可視化。
- **自己ベスト保存** — スニペットごとのベストを `localStorage` に記録。
- **自動インデント** — `Enter` を打つと次の行の先頭インデントは自動でスキップ。
- **モバイル対応 / PWA** — タップでソフトキーボードを呼び出して入力。インストール可能・オフライン対応（Service Worker）。
- **軽量初期ロード** — Three.js はゲーム開始時に動的読込（初期 JS は ~6KB gzip）。スニペットも言語ごとのチャンクに分かれていて、ラウンド開始時に選んだ言語のぶんだけ読み込む（残りはプレイ中のアイドル時に先読みしてオフラインに備える）。
- **アクセシビリティ** — `prefers-reduced-motion` でブルーム・シェイク・点滅を抑制。タブ離脱時は自動ポーズ。

## 操作

| キー | 動作 |
|------|------|
| 文字キー | 表示されたコードを入力 |
| `Enter` | 改行（次行の先頭インデントは自動スキップ） |
| `Backspace` | ミス直後はミスだけ取り消す。それ以外は1文字戻る |
| `Esc` | ポーズ / 再開 |
| `Tab` | 同じスニペットをやり直し |
| `?` ボタン | ヘルプ |
| 🔊 ピル | ミュート切替 |

## 起動

```bash
npm install
npm run dev      # http://localhost:5173
```

## 開発

```bash
npm run typecheck   # tsc --noEmit
npm run test        # Vitest（純ロジック + jsdom の UI 振る舞いテスト）
npm run coverage    # src/engine を 100%、UI 層（ui / input / modes / audio / game / main）を 98% 行カバレッジでゲート
npm run build       # 型チェック + 本番ビルド
```

### 構成

- `src/engine/` — 純ロジック（タイピング判定 / 統計 / スコア / 選曲 / 記録 / コンテンツ）。Vitest で 100% カバレッジを維持。
- `src/engine/content/languages/` — スニペット本体。1 言語 1 ファイル（記号ドリルは `drill.ts`）で、`content/index.ts` が `import()` で遅延読込する。言語を足すときは `types.ts` の `Language` と `LANGUAGE_ORDER`・ローダー・テーマ色・スタート画面のピル・README を更新する（テストが突き合わせる）。
- `src/modes/` — ゲームモード（`sprint`）と共通インターフェース。`game.ts` が共有サービス（描画・音・統計・結果）を持ち、モードを駆動。
- `src/render/` — Three.js（レンダラ + ブルーム / 反応するステージ / エフェクト）。
- `src/input/` — 物理キーボード / モバイルソフトキーボード。
- `src/audio/` — WebAudio 合成 SFX（アセット不要）。
- `src/ui/` — DOM の HUD・各画面・コード描画（CodeView）。
- `src/test/` — UI テスト用の共有フィクスチャ（`index.html` の実マークアップを jsdom に流し込む）。UI テストは `// @vitest-environment jsdom` で jsdom を選び、Testing Library でユーザー操作を再現する。`src/render/`（Three.js / WebGL）は jsdom で動かないためカバレッジ対象外。
- `src/main.ts` — 軽量ブートストラップ（スタート画面のみ）。`src/game.ts`（Three.js を含む本体）を `import()` で遅延読込。
- `public/` — `manifest.webmanifest`・`sw.js`（オフライン）・`ogp.png`（1200×630）・`favicon.svg`。

## 技術スタック

- Three.js
- TypeScript
- Vite
- Vitest

> `public/ogp.png` は `scratchpad/ogp.svg`（リポジトリ外）から macOS の `qlmanage` + `sips` で生成。差し替える場合は 1200×630 の PNG を置き換えてください。

## ホスティング

本番は **Cloudflare Workers (static assets)**: https://snippet-sprint.saitotakuya0719.workers.dev

2026-08-11、Vercel 無料枠の超過でアカウントが停止（全プロジェクトが
`402 DEPLOYMENT_DISABLED`）したため移行した。ビルド成果物は純粋な静的
ファイルなので Worker スクリプトは無く、`wrangler.jsonc` の `assets` だけで
配信している。セキュリティヘッダーは `public/_headers`（`vercel.json` の
`headers` を移植したもの）。`npm run deploy` で build + wrangler deploy。
Vercel 側の設定も残置してあるので、復旧すれば両方に出せる。

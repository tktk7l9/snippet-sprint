# Snippet Sprint — Code Typing Trainer

**[▶ Play Now](https://snippet-sprint.vercel.app)**

プログラミングのタイピング（記号・camelCase・インデント・実コードの流れ）を上達させるための Three.js 製タイピングゲーム。3 つのゲームモードを搭載。コード文字は鮮明な DOM、その背後で WebGL のネオンステージ（パーティクル / ブルーム / コンボ閃光 / ミス時シェイク）が入力にリアルタイムで反応する。

## ゲームモード

- **Sprint** — 表示された実コードのスニペットを左から1文字ずつ。正しい文字だけが先に進む strict モードで、クリア後に WPM・正確率・スコア・ランク（S〜D）と**弱点分析**。
- **Falling Tokens（アーケード）** — `=>` `.map(` などのトークンが 3D 空間を落下。先頭文字を打つとロックオン、最後まで打って撃破。床に落とすとライフが減り、0 でゲームオーバー。スコア・レベル・コンボ。
- **Code Runner** — コードの行を打ち続けてネオンのトンネルを疾走。正打で加速・ミスで減速し、ミスが続くと**クラッシュ**。走行距離がスコア。

## 特徴

- **実コード + アルゴリズム + 記号ドリル** — TypeScript / JavaScript・Python・Go・Rust・Java・C++・SQL の頻出パターン、二分探索・クイックソート・DP などの有名アルゴリズム、`=> === && || {} []` などの記号・演算子ドリル。
- **弱点分析** — どの記号でつまずいたかを可視化（全モード共通の統計）。
- **自己ベスト保存** — モード / スニペットごとのベストを `localStorage` に記録。
- **自動インデント** — `Enter` を打つと次の行の先頭インデントは自動でスキップ。
- **モバイル対応 / PWA** — タップでソフトキーボードを呼び出して入力。インストール可能・オフライン対応（Service Worker）。
- **軽量初期ロード** — Three.js はゲーム開始時に動的読込（初期 JS は ~3KB gzip）。
- **アクセシビリティ** — `prefers-reduced-motion` でブルーム・シェイク・点滅を抑制。タブ離脱時は自動ポーズ。

## 操作

| キー | 動作 |
|------|------|
| 文字キー | 表示されたコードを入力 |
| `Enter` | 改行（次行の先頭インデントは自動スキップ） |
| `Backspace` | 1文字戻る |
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
npm run test        # Vitest（純ロジック）
npm run coverage    # src/engine を 100% カバレッジでゲート
npm run build       # 型チェック + 本番ビルド
```

### 構成

- `src/engine/` — 純ロジック（タイピング判定 / 統計 / スコア / 選曲 / 記録 / コンテンツ / Falling / Runner）。Vitest で 100% カバレッジを維持。
- `src/modes/` — 3 つのゲームモード（`sprint` / `falling` / `runner`）と共通インターフェース。`main.ts` が共有サービス（描画・音・統計・結果）を持ち、選択モードを駆動。
- `src/render/` — Three.js（レンダラ + ブルーム / 反応するステージ / エフェクト）。
- `src/input/` — 物理キーボード / モバイルソフトキーボード。
- `src/audio/` — WebAudio 合成 SFX（アセット不要）。
- `src/ui/` — DOM の HUD・各画面・コード描画（CodeView）。
- `src/main.ts` — 軽量ブートストラップ（スタート画面のみ）。`src/game.ts`（Three.js を含む本体）を `import()` で遅延読込。
- `public/` — `manifest.webmanifest`・`sw.js`（オフライン）・`ogp.png`（1200×630）・`favicon.svg`。

## 技術スタック

- Three.js
- TypeScript
- Vite
- Vitest

> `public/ogp.png` は `scratchpad/ogp.svg`（リポジトリ外）から macOS の `qlmanage` + `sips` で生成。差し替える場合は 1200×630 の PNG を置き換えてください。

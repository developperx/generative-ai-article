# 生成AIトレンド

生成AIの活用方法に関する**最新トレンドを自動で集約**して一覧表示する、完全無料・サーバーレスのWebアプリです。
PC・スマホのブラウザからアクセスでき、各メディアの**公式RSS／公開API**のみを利用します（HTMLスクレイピングは行いません）。

## 特徴

- **完全無料**: 静的サイト（Astro）＋ GitHub Pages ＋ GitHub Actions。サーバー代・DB代ゼロ。
- **合法的な集約**: 公式RSS・公開APIのみ使用。表示は「タイトル・出典・日付・抜粋・元記事リンク」に限定し、本文は転載せず元サイトへ誘導します。
- **自動更新**: GitHub Actions の定期実行（既定で1日3回）で常に最新化。
- **APIキー不要**: 外部の有料サービスやLLM APIに依存しません。
- **モバイル最適化 & ダークモード**: レスポンシブ対応、テーマ切り替え。

## 主な機能

| 機能 | 説明 |
| --- | --- |
| トレンド新着フィード | タイトル / 出典 / 日付 / 抜粋 / タグ / 元記事リンクをカード表示 |
| 検索・絞り込み | キーワード検索、出典別・タグ別・期間（今日/今週/今月）フィルタ |
| タグ自動分類 | タイトル・抜粋からキーワードでタグ付け（LLM・画像生成・コーディング 等） |
| 話題順ソート | はてなブックマーク数が取れる記事はブクマ数で並べ替え可能 |
| あとで読む | `localStorage` に保存（ログイン不要・サーバー不要） |
| ダークモード | 端末設定に追従＋手動切り替え |

## 構成

```
[GitHub Actions (cron)] → fetch-feeds.mjs → data/items.json → Astro build → GitHub Pages
   data/sources.json を読み、各RSS/APIを取得 → 正規化 → 重複排除 → タグ付け
```

| パス | 役割 |
| --- | --- |
| `data/sources.json` | 取得対象ソースの一覧（追加・削除はここを編集） |
| `data/tag-rules.json` | タグ付け辞書 ＆ 生成AI判定キーワード |
| `data/items.json` | 取得結果（CIが上書き。初期値は表示確認用サンプル） |
| `scripts/fetch-feeds.mjs` | 取得・正規化・重複排除・タグ付けスクリプト |
| `src/pages/index.astro` | 一覧ページ＋クライアント側の検索/絞り込み |
| `src/layouts/Layout.astro` | 共通レイアウト・テーマ・スタイル |
| `.github/workflows/deploy.yml` | データ取得→ビルド→Pagesデプロイ |

## ローカルでの実行

```bash
npm install
npm run fetch   # 最新トレンドを取得して data/items.json を更新
npm run dev     # http://localhost:4321/generative-ai-article で確認
npm run build   # 本番ビルド（dist/ を生成）
```

> リポジトリ同梱の `data/items.json` は表示確認用のサンプルです。`npm run fetch` で実データに置き換わります。

## 公開（GitHub Pages）

1. このリポジトリを **Public** にする（Actions無制限・Pages無料のため）。
2. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定。
3. `main` ブランチへ push、または Actions の `Build & Deploy` を手動実行。
4. 公開URL: `https://developperx.github.io/generative-ai-article/`

別ホスティング（Cloudflare Pages 等）やカスタムドメインを使う場合は、`astro.config.mjs` の `site` / `base` を調整してください（ルート配信なら `base: '/'`）。

## ソースの追加・編集

`data/sources.json` の `sources` 配列に1要素追加するだけです。

```json
{
  "id": "any-unique-id",
  "name": "表示名",
  "type": "rss",
  "url": "https://example.com/feed",
  "defaultTags": ["LLM"],
  "keywordFilter": true,
  "enabled": true
}
```

- `keywordFilter: true` … 生成AI関連キーワード（`data/tag-rules.json` の `aiKeywords`）に一致した記事のみ取り込み。広範なメディア向け。
- `enabled: false` … 一時的に無効化。

## 更新頻度の変更

`.github/workflows/deploy.yml` の `cron`（UTC）を編集します。例: `'0 */6 * * *'` で6時間ごと。

## 法的・運用上の方針

- 各メディアの**公式RSS・公開API**のみを利用し、利用規約・レート制限・robots.txt を尊重します。
- 本文は保存・転載せず、見出し・出典・短い抜粋・元記事リンクのみを表示します。本文の著作権は各配信元に帰属します。
- 配信元から停止の要請があった場合は、該当ソースを `enabled: false` で無効化してください。

## 技術スタック

Astro（静的サイト生成）/ rss-parser（RSS取得）/ GitHub Actions（自動更新・デプロイ）/ GitHub Pages（ホスティング）。

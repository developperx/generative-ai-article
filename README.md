# 生成AIトレンド

生成AIの活用方法に関する**最新トレンドを自動で集約**して一覧表示する、完全無料・サーバーレスのWebアプリです。
PC・スマホのブラウザからアクセスでき、各メディアの**公式RSS／公開API**のみを利用します（HTMLスクレイピングは行いません）。

システム開発に関連する生成AIトピック（LLM・コーディング・エージェント・各種モデル 等）を中心に収集します。

## 特徴

- **完全無料**: 静的サイト（Astro）＋ Vercel ＋ GitHub Actions（定期取得トリガー）。サーバー代・DB代ゼロ。
- **合法的な集約**: 公式RSS・公開APIのみ使用。表示は「タイトル・出典・日付・抜粋・元記事リンク」に限定し、本文は転載せず元サイトへ誘導します。
- **自動更新**: GitHub Actions の定期実行（既定で1日3回）が Vercel の再ビルドをトリガーし、常に最新化。
- **APIキー不要**: 外部の有料サービスやLLM APIに依存しません。
- **モバイル最適化 & ダークモード**: レスポンシブ対応、テーマ切り替え。

## 主な機能

| 機能 | 説明 |
| --- | --- |
| トレンド新着フィード | タイトル / 出典 / 日付 / 抜粋 / タグ / 元記事リンクをカード表示 |
| 検索・絞り込み | キーワード検索、出典別・タグ別・期間（今日/今週/今月）フィルタ |
| タグ自動分類 | タイトル・抜粋からキーワードでタグ付け（LLM・Claude・ChatGPT・コーディング 等） |
| 人気順ソート | ブックマーク数などの指標が取得できる記事は人気順で並べ替え可能 |
| あとで読む | `localStorage` に保存（ログイン不要・サーバー不要） |
| ダークモード | 端末設定に追従＋手動切り替え |

### タグ一覧

記事には以下のタグが自動付与され、タグチップで絞り込めます（`data/tag-rules.json` で管理）。

`LLM` / `Claude` / `Claude Code` / `ChatGPT` / `Gemini` / `画像生成` / `コーディング` / `エージェント` / `プロンプト` / `モデルリリース` / `業務活用` / `規制・動向`

## 構成

```
[GitHub Actions (cron)] --POST--> [Vercel Deploy Hook]
                                       │
                                       ▼
                         [Vercel] npm run fetch && npm run build
                          fetch-feeds.mjs:
                            data/sources.json を読み、各RSS/APIを取得
                            → 正規化 → 重複排除 → タグ付け
                            → public/data/items.json を生成
                                       │
                                       ▼
                               自動デプロイ（公開）

別経路: main へ git push → Vercel が自動でビルド＆デプロイ
```

| パス | 役割 |
| --- | --- |
| `data/sources.json` | 取得対象ソースの一覧（追加・削除はここを編集） |
| `data/tag-rules.json` | タグ付け辞書 ＆ 生成AI判定キーワード |
| `public/data/items.json` | 取得結果（CIが上書き・ブラウザがランタイムfetchする対象）。初期値は表示確認用サンプル |
| `scripts/fetch-feeds.mjs` | 取得・正規化・重複排除・タグ付けスクリプト |
| `src/pages/index.astro` | 一覧ページ＋クライアント側の検索/絞り込み |
| `src/layouts/Layout.astro` | 共通レイアウト・テーマ・スタイル |
| `astro.config.mjs` | Astro 設定（Vercel のルート配信。`site` のみ指定、`base` なし） |
| `vercel.json` | Vercel のビルド設定＋`items.json` のキャッシュ制御 |
| `.github/workflows/deploy.yml` | Vercel Deploy Hook を叩く定期トリガー（cron / 手動実行） |

## ローカルでの実行

```bash
npm install
npm run fetch   # 最新トレンドを取得して public/data/items.json を更新
npm run dev     # http://localhost:4321/ で確認
npm run build   # 本番ビルド（dist/ を生成）
```

> リポジトリ同梱の `public/data/items.json` は表示確認用のサンプルです。`npm run fetch` で実データに置き換わります。

## 公開（Vercel）

Vercel と GitHub アカウントを連携済みであることを前提とします。

1. Vercel ダッシュボード → **Add New Project** → このリポジトリをインポート。
   - Framework Preset・Build Command（`npm run fetch && npm run build`）・Output Directory（`dist`）は `vercel.json` から自動反映されます。
2. **Deploy** を実行し、払い出された公開URLを確認。
3. 定期更新用に Deploy Hook を作成: Vercel → プロジェクト **Settings → Git → Deploy Hooks** でフック（ブランチ `main`）を作成し、URL をコピー。
4. GitHub リポジトリ **Settings → Secrets and variables → Actions** に、`VERCEL_DEPLOY_HOOK_URL` という名前で 3 の URL を登録。
5. （任意）旧 GitHub Pages を使っていた場合は **Settings → Pages → Source → None** で無効化。

以後、`main` への push で自動デプロイされ、GitHub Actions の cron が定期的に Deploy Hook を叩いて最新データで再ビルドします。

> カスタムドメインを使う場合は Vercel 側でドメインを設定し、`astro.config.mjs` の `site` を実際のURLに更新してください。

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
- `keywordFilter: false` … フィード内の全記事を取り込み。Zenn/Qiita のトピック・タグ単位フィード（例: `zenn.dev/topics/claude/feed`、`qiita.com/tags/llm/feed`）など、対象が絞られたソース向け。`defaultTags` を指定すると全記事に確実にそのタグが付きます。
- `enabled: false` … 一時的に無効化（取得対象から除外）。

## 更新頻度の変更

`.github/workflows/deploy.yml` の `cron`（UTC）を編集します。例: `'0 */6 * * *'` で6時間ごとに Deploy Hook を発火。

## 法的・運用上の方針

- 各メディアの**公式RSS・公開API**のみを利用し、利用規約・レート制限・robots.txt を尊重します。
- 本文は保存・転載せず、見出し・出典・短い抜粋・元記事リンクのみを表示します。本文の著作権は各配信元に帰属します。
- 配信元から停止の要請があった場合は、該当ソースを `enabled: false` で無効化してください。

## 技術スタック

Astro（静的サイト生成）/ rss-parser（RSS取得）/ GitHub Actions（定期取得トリガー）/ Vercel（ホスティング・自動デプロイ）。

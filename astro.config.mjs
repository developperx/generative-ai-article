// @ts-check
import { defineConfig } from 'astro/config';

// GitHub Pages 用の設定。
// 公開URLは https://developperx.github.io/generative-ai-article/ を想定。
// 別ホスティング（Cloudflare Pages 等）やカスタムドメインを使う場合は
// site / base を書き換えてください（ルート配信なら base は '/'）。
export default defineConfig({
  site: 'https://developperx.github.io',
  base: '/generative-ai-article',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});

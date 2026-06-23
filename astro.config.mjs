// @ts-check
import { defineConfig } from 'astro/config';

// Vercel 用の設定。ルートパスで配信されるため base は不要。
// カスタムドメインを設定した場合は site を書き換えてください。
export default defineConfig({
  site: 'https://generative-ai-article.vercel.app',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});

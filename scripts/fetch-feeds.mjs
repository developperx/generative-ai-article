// 生成AIトレンド取得スクリプト
//
// data/sources.json で定義した公式RSS/公開APIを取得し、
// 正規化 → キーワードフィルタ → タグ付け → 重複排除 → 日付降順ソート
// を行って public/data/items.json に書き出します（ランタイムfetch用）。
//
// ・HTMLスクレイピングは行いません（RSS/APIのみ）。
// ・全文は保存せず、タイトル・出典・日付・短い抜粋・元記事URLのみ扱います。
// ・1ソースの取得失敗が全体を止めないよう Promise.allSettled で個別処理します。

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import Parser from 'rss-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');       // sources.json / tag-rules.json の場所
const PUBLIC_DATA_DIR = path.join(ROOT, 'public', 'data'); // items.json の出力先

const MAX_ITEMS = 600; // 出力する最大件数
const SNIPPET_MAX = 180; // 抜粋の最大文字数
const USER_AGENT =
  'GenerativeAITrends/0.1 (+https://github.com/developperx/generative-ai-article; RSS aggregator)';

const parser = new Parser({
  timeout: 20000,
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  customFields: {
    item: [
      ['hatena:bookmarkcount', 'bookmarkCount'],
      ['dc:date', 'dcDate'],
    ],
  },
});

async function readJson(file) {
  const raw = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
  return JSON.parse(raw);
}

function stripHtml(s = '') {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSnippet(item) {
  const text = stripHtml(item.contentSnippet || item.content || item.summary || '');
  if (text.length <= SNIPPET_MAX) return text;
  return text.slice(0, SNIPPET_MAX).trimEnd() + '…';
}

// URLを正規化して重複排除キーを作る（トラッキングパラメータ等を除去）
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    const drop = [...u.searchParams.keys()].filter(
      (k) => /^utm_/i.test(k) || ['ref', 'ref_src', 'cmpid', 'fbclid', 'gclid'].includes(k.toLowerCase())
    );
    drop.forEach((k) => u.searchParams.delete(k));
    let key = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`;
    if ([...u.searchParams].length) key += `?${u.searchParams.toString()}`;
    return key.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function hashId(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
}

function matchesAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

function assignTags(text, tagRules, defaultTags) {
  const tags = new Set(defaultTags || []);
  for (const [tag, keywords] of Object.entries(tagRules.tags)) {
    if (matchesAny(text, keywords)) tags.add(tag);
  }
  return [...tags];
}

function toIso(item) {
  const raw = item.isoDate || item.dcDate || item.pubDate;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

async function fetchSource(source, tagRules) {
  const feed = await parser.parseURL(source.url);
  const items = [];
  for (const item of feed.items || []) {
    const url = item.link;
    const title = stripHtml(item.title || '');
    if (!url || !title) continue;

    const snippet = makeSnippet(item);
    const haystack = `${title} ${snippet}`;

    // 広範なメディアは生成AI関連のみ取り込む
    if (source.keywordFilter && !matchesAny(haystack, tagRules.aiKeywords)) continue;

    const bookmarkCount = item.bookmarkCount != null ? Number(item.bookmarkCount) : null;

    items.push({
      id: hashId(normalizeUrl(url)),
      title,
      url,
      source: source.name,
      sourceId: source.id,
      tags: assignTags(haystack, tagRules, source.defaultTags),
      publishedAt: toIso(item),
      snippet,
      bookmarkCount: Number.isFinite(bookmarkCount) ? bookmarkCount : null,
      dedupeKey: normalizeUrl(url),
    });
  }
  return items;
}

async function main() {
  const [{ sources }, tagRules] = await Promise.all([
    readJson('sources.json'),
    readJson('tag-rules.json'),
  ]);

  const enabled = sources.filter((s) => s.enabled !== false);
  const results = await Promise.allSettled(enabled.map((s) => fetchSource(s, tagRules)));

  const all = [];
  const report = [];
  results.forEach((res, i) => {
    const src = enabled[i];
    if (res.status === 'fulfilled') {
      all.push(...res.value);
      report.push(`  ✓ ${src.name}: ${res.value.length} 件`);
    } else {
      report.push(`  ✗ ${src.name}: 取得失敗 (${res.reason?.message || res.reason})`);
    }
  });

  // 重複排除（同一URLは新しい方／ブクマ数が多い方を残す）
  const byKey = new Map();
  for (const item of all) {
    const prev = byKey.get(item.dedupeKey);
    if (!prev) {
      byKey.set(item.dedupeKey, item);
      continue;
    }
    const prevDate = prev.publishedAt ? Date.parse(prev.publishedAt) : 0;
    const curDate = item.publishedAt ? Date.parse(item.publishedAt) : 0;
    if (curDate > prevDate || (item.bookmarkCount || 0) > (prev.bookmarkCount || 0)) {
      byKey.set(item.dedupeKey, item);
    }
  }

  const deduped = [...byKey.values()]
    .sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0))
    .slice(0, MAX_ITEMS)
    .map(({ dedupeKey, ...rest }) => rest);

  const output = {
    updatedAt: new Date().toISOString(),
    count: deduped.length,
    sources: enabled.map((s) => ({ id: s.id, name: s.name })),
    items: deduped,
  };

  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, 'items.json'), JSON.stringify(output, null, 2) + '\n', 'utf-8');

  console.log('ソース取得結果:');
  console.log(report.join('\n'));
  console.log(`\n合計 ${all.length} 件 → 重複排除後 ${deduped.length} 件を public/data/items.json に書き出しました。`);
}

main().catch((err) => {
  console.error('致命的なエラー:', err);
  process.exit(1);
});

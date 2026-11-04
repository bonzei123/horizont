export const REDDIT_SUBS = ['UFOs', 'aliens', 'HighStrangeness', 'UAP', 'UFOscience', 'ufo', 'Experiencers'];

export function redditPath(kind) {
  const multi = REDDIT_SUBS.join('+');
  if (kind === 'fresh') return `/r/${multi}/new.rss?limit=25`;
  return `/r/${multi}/top.rss?t=week&limit=25`;
}

export function parseFeed(xml, { source = '', kind = 'reddit' } = {}) {
  const text = String(xml || '');
  let chunks = splitBlocks(text, 'entry');
  if (!chunks.length) chunks = splitBlocks(text, 'item');
  const posts = [];
  for (const block of chunks) {
    const title = tagText(block, 'title');
    const href = attrValue(block, 'link', 'href') || tagText(block, 'link');
    if (!title || !/^https?:\/\//.test(href)) continue;
    const sub = attrValue(block, 'category', 'term');
    const at = Date.parse(tagText(block, 'published') || tagText(block, 'updated') || tagText(block, 'pubDate'));
    const thumb = attrValue(block, 'media:thumbnail', 'url');
    posts.push({
      title,
      href,
      source: kind === 'reddit' && sub && sub !== 'multi' ? `r/${sub}` : source,
      kind,
      at: Number.isFinite(at) ? at : null,
      thumb: /^https?:\/\//.test(thumb) ? thumb : '',
    });
  }
  return posts;
}

export function selectPosts(bundle, view, sub) {
  const key = view === 'fresh' ? 'fresh' : view === 'press' ? 'press' : 'week';
  const rows = Array.isArray(bundle?.[key]) ? bundle[key] : [];
  if (!sub || sub === 'alle') return rows;
  return rows.filter((post) => post.source === sub);
}

function splitBlocks(xml, name) {
  return xml.split(new RegExp(`<${name}\\b`, 'i')).slice(1).map((part) => part.split(new RegExp(`</${name}>`, 'i'))[0]);
}

function tagText(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function attrValue(block, tagName, attrName) {
  const match = block.match(new RegExp(`<${tagName}\\b[^>]*\\s${attrName}="([^"]*)"`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

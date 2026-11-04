import fs from 'node:fs';
import path from 'node:path';
import { parseFeed, redditPath } from '../src/feeds.js';

const out = path.join(process.cwd(), 'public', 'news.json');
const ua = 'Mozilla/5.0 (compatible; HorizontAlmanach/1.0; +https://github.com/bonzei123/horizont)';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pull(url, options) {
  const response = await fetch(url, {
    headers: { 'user-agent': ua, accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return parseFeed(await response.text(), options);
}

async function main() {
  const bundle = { fetchedAt: new Date().toISOString(), week: [], fresh: [], press: [] };
  const jobs = [
    ['week', `https://www.reddit.com${redditPath('week')}`, { kind: 'reddit' }],
    ['fresh', `https://www.reddit.com${redditPath('fresh')}`, { kind: 'reddit' }],
    ['press', 'https://news.google.com/rss/search?q=%22UAP%22+OR+%22UFO+sighting%22+OR+%22Pentagon+UFO%22+OR+AARO+when:14d&hl=en-US&gl=US&ceid=US:en', { kind: 'press', source: 'Google News' }],
    ['press', 'https://news.google.com/rss/search?q=%22Ufo-Sichtung%22+OR+%22UAP%22+OR+%22Pentagon%22+Ufo+when:14d&hl=de&gl=DE&ceid=DE:de', { kind: 'press', source: 'Google News' }],
  ];
  for (const [key, url, options] of jobs) {
    try {
      const posts = await pull(url, options);
      bundle[key].push(...posts);
      console.log(key, posts.length, url.slice(0, 80));
    } catch (error) {
      console.warn('feed skipped', error.message);
    }
    await pause(12000);
  }
  const seen = new Set();
  bundle.press = bundle.press.filter((post) => {
    if (seen.has(post.href)) return false;
    if (!/uap|ufo|uaps|alien|anomal|nih\b|pentagon|gimbal|tic tac|greifswald|aaro|congress/i.test(post.title)) return false;
    seen.add(post.href);
    return true;
  }).slice(0, 20);
  bundle.week = bundle.week.slice(0, 25);
  bundle.fresh = bundle.fresh.slice(0, 25);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`);
  const count = bundle.week.length + bundle.fresh.length + bundle.press.length;
  if (!count) {
    console.warn('no posts fetched, wrote an empty bundle');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 0;
});

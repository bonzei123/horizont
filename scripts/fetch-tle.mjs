import fs from 'node:fs';
import path from 'node:path';

const out = path.join(process.cwd(), 'public', 'tle-visual.txt');
const url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=3le';

try {
  const response = await fetch(url, {
    headers: { 'user-agent': 'HorizontAlmanach/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(String(response.status));
  const text = await response.text();
  if (!text.includes('\n1 ')) throw new Error('kein TLE');
  fs.writeFileSync(out, text);
  console.log('tle', text.length);
} catch (error) {
  console.warn('tle skipped', error.message);
}

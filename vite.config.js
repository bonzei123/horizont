import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
    proxy: {
      '/api/feed': {
        target: 'https://www.reddit.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/feed/, ''),
        headers: { 'user-agent': 'HorizontAlmanach/1.0' },
      },
      '/api/adsb': {
        target: 'https://api.adsb.lol',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/adsb/, ''),
      },
      '/api/tle': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        rewrite: () => '/NORAD/elements/gp.php?GROUP=visual&FORMAT=3le',
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 43123,
    strictPort: true,
  },
});

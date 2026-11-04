import {
  DESKS,
  ON_THIS_DAY,
  SENSORS,
  SHELF,
  WAVES,
  editionLabel,
  onThisDay,
} from './almanac.js';
import { h } from './dom.js';
import { formatAgo } from './format.js';
import { selectPosts } from './feeds.js';

const VIEWS = [
  ['week', 'Woche'],
  ['fresh', 'Neu'],
  ['press', 'Presse'],
];

export function newsTeaser(news) {
  const posts = (news?.week || []).slice(0, 3);
  return h('section', { class: 'panel', 'data-news-teaser': '1' },
    h('p', { class: 'kicker' }, 'Lage'),
    h('h2', {}, 'Was diese Woche kursiert'),
    h('div', { class: 'stack' }, posts.length
      ? posts.map((post) => h('a', {
        class: 'teaser-link',
        href: post.href,
        target: '_blank',
        rel: 'noreferrer',
      }, h('span', {}, post.source || 'Beitrag'), post.title))
      : [h('p', {}, 'Die Lage wird geladen. Im Almanach stehen derweil die Tage, Wellen und Stellen.')]),
    h('a', { href: '#/almanach' }, 'Almanach öffnen'),
  );
}

export function renderAlmanach(ctx) {
  const today = onThisDay(new Date(ctx.state.clock));
  return h('section', { class: 'screen prose-page' },
    h('p', { class: 'kicker' }, 'Almanach'),
    h('h1', {}, 'Alles an einem Ort.'),
    h('p', { class: 'lede' }, `Ausgabe vom ${editionLabel(new Date(ctx.state.clock))}. Oben die Lage aus den großen UAP-Subreddits und der Presse. Darunter das Nachschlagewerk: dieser Tag, die Wellen, die Stellen, das Regal, die Sensoren.`),
    h('div', { class: 'row-actions' },
      ...[['heute', 'Heute'], ['lage', 'Lage'], ['wellen', 'Wellen'], ['stellen', 'Stellen'], ['regal', 'Regal'], ['sensoren', 'Sensoren']].map(([id, label]) => jump(id, label)),
    ),
    h('section', { class: 'stack', id: 'heute' },
      h('h2', {}, 'Heute im Almanach'),
      today.length
        ? h('div', { class: 'stack' }, ...today.map((item) => h('article', { class: 'panel' },
          h('p', { class: 'kicker' }, String(item.year)),
          h('h3', {}, item.title),
          h('p', {}, item.text),
        )))
        : h('p', {}, 'An diesem Kalendertag liegt kein großer Eintrag. Die Lage und die Wellen gelten trotzdem.'),
    ),
    h('section', { class: 'stack', id: 'lage' },
      h('h2', {}, 'Die Lage'),
      h('p', {}, 'Top der Woche und die neuesten Beiträge aus r/UFOs, r/aliens, r/HighStrangeness, r/UAP, r/UFOscience, r/ufo und r/Experiencers. Dazu Presse der letzten zwei Wochen. Das sind fremde Beiträge. Horizont prüft sie nicht und schickt nichts weg.'),
      h('div', { class: 'row-actions', 'data-news-views': '1' },
        ...VIEWS.map(([id, label]) => h('button', {
          class: `btn btn-ghost${ctx.state.newsView === id ? ' is-on' : ''}`,
          type: 'button',
          'data-news-view': id,
          onClick: () => ctx.setNewsView(id),
        }, label)),
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ctx.reloadNews() }, 'Neu laden'),
      ),
      h('div', { class: 'row-actions', 'data-news-subs': '1' }),
      h('p', { class: 'hint', 'data-news-status': '1' }, newsStatus(ctx.state.news, ctx.state.clock)),
      h('div', { class: 'stack', 'data-news-list': '1' },
        ...newsCards(ctx.state.news, ctx.state.newsView, ctx.state.newsSub, ctx.state.clock),
      ),
    ),
    catalog('wellen', 'Wellen', 'Viele Meldungen in kurzer Zeit. Eine Welle ist erst einmal ein Berg von Berichten, keine Herkunft.', WAVES),
    catalog('stellen', 'Stellen', 'Wer sammelt, wer ermittelt, wer eine Übung anbietet. Die private Meldestelle und die Behörde stehen hier nebeneinander, weil die Leute sie verwechseln.', DESKS),
    catalog('regal', 'Regal', 'Bücher und das eine kurze Amtsdokument. Keine Auszüge, nur wofür das Stück steht.', SHELF),
    catalog('sensoren', 'Sensoren', 'Wörter, die in den Navy-Videos und in jedem zweiten Thread auftauchen.', SENSORS),
    h('p', { class: 'hint' }, `${ON_THIS_DAY.length} Tage im Almanach. Das Handbuch daneben bleibt der Einsatz auf dem Feld.`),
  );
}

export function paintNews(state) {
  const list = document.querySelector('[data-news-list]');
  if (list) {
    list.replaceChildren(...newsCards(state.news, state.newsView, state.newsSub, state.clock));
  }
  const status = document.querySelector('[data-news-status]');
  if (status) status.textContent = newsStatus(state.news, state.clock);
  for (const button of document.querySelectorAll('[data-news-view]')) {
    button.classList.toggle('is-on', button.dataset.newsView === state.newsView);
  }
  const subs = document.querySelector('[data-news-subs]');
  if (subs) {
    const sources = sourcesFor(state.news, state.newsView);
    subs.replaceChildren(...(state.newsView === 'press' ? [] : [
      subButton(state, 'alle', 'Alle'),
      ...sources.map((source) => subButton(state, source, source)),
    ]));
  }
  const teaser = document.querySelector('[data-news-teaser]');
  if (teaser) {
    const posts = (state.news?.week || []).slice(0, 3);
    const stack = teaser.querySelector('.stack');
    if (posts.length && stack) {
      stack.replaceChildren(...posts.map((post) => h('a', {
        class: 'teaser-link',
        href: post.href,
        target: '_blank',
        rel: 'noreferrer',
      }, h('span', {}, post.source || 'Beitrag'), post.title)));
    }
  }
}

function subButton(state, id, label) {
  return h('button', {
    class: `btn btn-ghost${state.newsSub === id ? ' is-on' : ''}`,
    type: 'button',
    onClick: () => {
      state.newsSub = id;
      paintNews(state);
    },
  }, label);
}

function sourcesFor(news, view) {
  const rows = selectPosts(news, view, 'alle');
  return [...new Set(rows.map((post) => post.source).filter(Boolean))];
}

function newsCards(news, view, sub, now) {
  if (!news || news.status === 'loading') return [h('p', {}, 'Die Lage wird geladen.')];
  const posts = selectPosts(news, view, sub);
  if (!posts.length) return [h('p', {}, 'In dieser Sicht ist gerade nichts angekommen.')];
  return posts.map((post) => h('a', {
    class: 'panel news-card',
    href: post.href,
    target: '_blank',
    rel: 'noreferrer',
  },
    post.thumb ? h('img', {
      class: 'news-thumb',
      src: post.thumb,
      alt: '',
      referrerpolicy: 'no-referrer',
      onError: (event) => event.currentTarget.remove(),
    }) : null,
    h('div', {},
      h('p', { class: 'kicker' }, [post.source, formatAgo(post.at, now)].filter(Boolean).join(' · ')),
      h('h3', {}, post.title),
    ),
  ));
}

function newsStatus(news) {
  if (!news?.fetchedAt) return 'Noch kein Stand. Neu laden holt die Feeds, wenn das Netz sie hergibt.';
  const when = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(news.fetchedAt));
  return news.live ? `Live, Stand ${when}.` : `Stand ${when}, aus dem letzten Build. Neu laden versucht die Feeds direkt.`;
}

function jump(id, label) {
  return h('button', {
    class: 'btn btn-ghost',
    type: 'button',
    onClick: () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  }, label);
}

function catalog(id, title, intro, rows) {
  return h('section', { class: 'stack', id },
    h('h2', {}, title),
    h('p', {}, intro),
    h('div', {}, ...rows.map(([name, text]) => h('p', { class: 'ref-entry' }, h('strong', {}, name), text))),
  );
}

/* Footbel — amélioration progressive des pages statiques.
   Les pages sont complètes sans JavaScript ; ce script ajoute : favoris (appareil), recherche instantanée,
   « Mon club », filtres des résultats, graphiques redessinés à la bonne largeur, anciennes URL #/… */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const body = document.body;
  const BASE = (body && body.dataset.base) || '';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };
  const LANG = (body && body.dataset.lang) || 'fr';
  const D = window.I18N || { fr: {} };
  const t = k => (D[LANG] && D[LANG][k]) || (D.fr && D.fr[k]) || k;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const cache = {};
  const load = p => (cache[p] = cache[p] || fetch(BASE + '/data/' + p).then(r => { if (!r.ok) throw new Error(p); return r.json(); }));
  const icon = (n, s) => `<img src="${BASE}/assets/i-${n}.webp" width="${s || 24}" height="${s || 24}" alt="" loading="lazy">`;

  /* ---------------------------------------------------------------- URL (mêmes règles que footbel/pages.py) */
  const U = {
    series: (s, id, l) => `${BASE}/${l || LANG}/${(D[l || LANG] || D.fr).seg_series}/${s.s[id]}/`,
    stats: (s, id) => `${U.series(s, id)}${t('seg_stats')}/`,
    team: (s, id, l) => s.t[id] ? `${BASE}/${l || LANG}/${(D[l || LANG] || D.fr).seg_team}/${s.t[id]}/` : null
  };

  /* ---------------------------------------------------------------- racine : langue et anciennes URL #/c/… #/t/… */
  if (window.FOOTBEL_ROOT) {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    let lang = store.get('footbel.lang', null) || ((navigator.language || '').slice(0, 2));
    if (!['fr', 'nl', 'de'].includes(lang)) lang = 'fr';
    if ((h[0] === 'c' || h[0] === 't') && h[1]) {
      load('slugs.json').then(s => { const u = h[0] === 'c' && s.s[h[1]] ? U.series(s, h[1], lang) : U.team(s, h[1], lang); location.replace(u || `${BASE}/${lang}/`); })
        .catch(() => location.replace(`${BASE}/${lang}/`));
    } else {
      location.replace(`${BASE}/${lang}/`);
    }
    return;
  }
  $$('.lang a').forEach(a => a.addEventListener('click', () => store.set('footbel.lang', a.dataset.lang)));

  /* ---------------------------------------------------------------- favoris */
  const Fav = {
    data: store.get('footbel.fav', { t: [], s: [] }),
    has(k, id) { return (this.data[k] || []).includes(id); },
    toggle(k, id) {
      const a = this.data[k] = this.data[k] || [];
      const i = a.indexOf(id);
      if (i >= 0) a.splice(i, 1); else a.unshift(id);
      store.set('footbel.fav', this.data);
      return i < 0;
    },
    list(k) { return (this.data[k] || []).slice(); },
    any() { return this.list('t').length + this.list('s').length > 0; }
  };
  function paintPins(root) {
    $$('[data-pin]', root).forEach(b => {
      const [k, id] = b.dataset.pin.split(':');
      const on = Fav.has(k, id);
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', on ? t('unpin') : t('pin'));
      b.title = on ? t('unpin') : t('pin');
      const sp = $('span', b); if (sp) sp.textContent = on ? t('pinned') : t('pin');
    });
    const ft = new Set(Fav.list('t'));
    $$('tr[data-t]', root).forEach(tr => tr.classList.toggle('me', ft.has(tr.dataset.t)));
    $$('.match[data-h]', root).forEach(li => {
      const a = $$('.match__team', li);
      if (a[0]) a[0].classList.toggle('fav', ft.has(li.dataset.h));
      if (a[1]) a[1].classList.toggle('fav', ft.has(li.dataset.a));
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pin]');
    if (b) {
      e.preventDefault();
      const [k, id] = b.dataset.pin.split(':');
      Fav.toggle(k, id);
      paintPins(document);
      return;
    }
    if (!e.target.closest('.search')) { const s = $('#suggest'); if (s) s.hidden = true; }
  });
  paintPins(document);

  /* ---------------------------------------------------------------- recherche */
  let SEARCH = null;
  async function searchData() {
    if (!SEARCH) SEARCH = Promise.all([load('index.json'), load('teams.json'), load('slugs.json')]);
    return SEARCH;
  }
  async function searchAll(q, n) {
    q = fold(q.trim());
    if (q.length < 2) return [];
    const [idx, teams, s] = await searchData();
    const hits = [];
    idx.competitions.forEach(c => {
      const name = (c.names && c.names[LANG]) || c.official_name;
      if (fold(name + ' ' + (c.sporting_province || '') + ' ' + c.level).includes(q))
        hits.push({ k: 's', url: U.series(s, c.public_id), name: name.trim(), sub: [c.level, c.sporting_province].filter(Boolean).join(' · '), score: fold(name).startsWith(q) ? 0 : 1 });
    });
    Object.keys(teams).forEach(id => {
      const nm = teams[id].name, u = U.team(s, id);
      if (u && fold(nm).includes(q)) { const c0 = teams[id].competitions[0] || {}; hits.push({ k: 't', url: u, name: nm, sub: ((c0.names && c0.names[LANG]) || c0.official_name || '').trim(), score: fold(nm).startsWith(q) ? 0 : 1 }); }
    });
    hits.sort((a, b) => a.score - b.score || (a.k === 't' ? -1 : 1) || a.name.localeCompare(b.name));
    return hits.slice(0, n);
  }
  const hitLink = h => `<a href="${h.url}">${icon(h.k === 's' ? 'trophee' : 'maillot', 22)}<span><b>${esc(h.name)}</b><small>${esc(h.sub)}</small></span></a>`;
  const q = $('#q'), sug = $('#suggest');
  if (q && sug) {
    q.addEventListener('input', async () => {
      const v = q.value, hits = await searchAll(v, 10);
      if (q.value !== v) return;
      if (v.trim().length < 2) { sug.hidden = true; return; }
      sug.innerHTML = hits.map(hitLink).join('') || `<span class="empty">${t('search_empty')}</span>`;
      sug.hidden = false;
    });
    q.form.addEventListener('submit', e => { const a = $('a', sug); if (a) { e.preventDefault(); location.href = a.href; } });
    q.addEventListener('keydown', e => { if (e.key === 'Escape') { sug.hidden = true; q.blur(); } });
  }
  const bq = $('#bigq');
  if (bq) {
    const hitsBox = $('#hits'), dir = $('#dir');
    const run = async () => {
      const v = bq.value, hits = await searchAll(v, 40);
      if (bq.value !== v) return;
      if (v.trim().length < 2) { hitsBox.hidden = true; dir.hidden = false; return; }
      hitsBox.hidden = false; dir.hidden = true;
      hitsBox.innerHTML = hits.length ? `<div class="card suggest suggest--static">${hits.map(hitLink).join('')}</div>` : `<p class="empty">${t('search_empty')}</p>`;
    };
    bq.addEventListener('input', run);
    bq.form.addEventListener('submit', e => { e.preventDefault(); const a = $('#hits a'); if (a) location.href = a.href; });
    const pre = new URLSearchParams(location.search).get('q');
    if (pre) { bq.value = pre; run(); }
  }

  /* ---------------------------------------------------------------- favoris : accueil & mon club */
  const formPills = (arr, lg) => arr && arr.length ? `<span class="form${lg ? ' form--lg' : ''}">${arr.map(r => `<i class="f f--${r}">${t('f' + r.toLowerCase())}</i>`).join('')}</span>` : '—';
  const fmtDay = iso => new Date(iso).toLocaleDateString(LANG + '-BE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Brussels' });
  const fmtTime = iso => new Date(iso).toLocaleTimeString(LANG + '-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
  function matchHtml(m, s) {
    const done = m.sh != null && m.sa != null && ['played', 'awarded', 'forfeit'].includes(m.s);
    const cls = side => { if (!done) return ''; const f = side === 'h' ? m.sh : m.sa, a = side === 'h' ? m.sa : m.sh; return f > a ? ' win' : f < a ? ' lose' : ''; };
    const link = (id, name, side) => { const u = U.team(s, id); return u ? `<a class="match__team${side === 'h' ? ' match__team--h' : ''}${cls(side)}" href="${u}">${esc(name)}</a>` : `<span class="match__team">${esc(name)}</span>`; };
    const sc = done ? `<span class="score">${m.sh}<i>–</i>${m.sa}</span>` : m.s === 'scheduled' ? `<span class="score score--up">${fmtTime(m.k)}</span>` : `<span class="score score--st">${esc(t(m.s))}</span>`;
    return `<li class="match" data-h="${m.hid}" data-a="${m.aid}"><span class="match__when"><b>${fmtDay(m.k)}</b></span>${link(m.hid, m.h, 'h')}${sc}${link(m.aid, m.a, 'a')}</li>`;
  }
  async function teamCard(pid, s) {
    const teams = await load('teams.json');
    const e = teams[pid]; if (!e) return '';
    const cs = (await Promise.all(e.competitions.map(c => load(c.public_id + '.json').catch(() => null)))).filter(Boolean);
    const rows = cs.map(c => { const tm = c.teams.find(x => x.public_id === pid); return { c, tm, row: c.standings && c.standings.all ? c.standings.all.find(r => r.team_id === tm.id) : null }; });
    rows.sort((a, b) => (b.row ? 1 : 0) - (a.row ? 1 : 0));
    const x = rows[0]; if (!x) return '';
    const names = {}; x.c.teams.forEach(tm => { names[tm.id] = tm.name; });
    const ms = x.c.matches.filter(m => m.home === x.tm.id || m.away === x.tm.id).map(m => ({ k: m.kickoff, s: m.status, h: names[m.home], a: names[m.away], hid: m.home_public_id, aid: m.away_public_id, sh: m.home_score, sa: m.away_score }));
    const done = ms.filter(m => m.sh != null && ['played', 'awarded', 'forfeit'].includes(m.s));
    const last = done[done.length - 1], next = ms.find(m => m.s === 'scheduled');
    const F = x.c.stats.form && x.c.stats.form.teams[x.tm.id];
    const r = x.row;
    const stat = (v, l, cls) => `<div class="stat ${cls || ''}"><b>${v}</b><span>${l}</span></div>`;
    return `<article class="card"><div class="card__head"><h3>${icon('maillot', 22)}<a href="${U.team(s, pid)}">${esc(e.name)}</a></h3><button type="button" class="pin pin--icon" data-pin="t:${pid}">${icon('epingle-favori', 22)}</button></div>
      <div class="tcard__body"><a class="small muted" href="${U.series(s, x.c.public_id)}">${esc(((x.c.names && x.c.names[LANG]) || x.c.official_name).trim())} · ${esc(x.c.level)}</a>
        <div class="tcard__stats">${r ? stat(r.rank, t('rank'), 'stat--rank') + stat(r.points, t('pts')) + stat(r.played, t('pld')) : ''}${F && F.last5.played ? stat(`${F.last5.points}<small>/${F.last5.played * 3}</small>`, t('last5')) : ''}
          <div class="stat"><span>${t('form')}</span><div class="mt6">${formPills(F ? F.last5.results : [], true)}</div></div></div></div>
      <div class="tcard__matches"><div class="mcard"><span class="mcard__label">${t('last_match')}</span>${last ? `<ul class="matches">${matchHtml(last, s)}</ul>` : '—'}</div>
        <div class="mcard"><span class="mcard__label">${t('next_match')}</span>${next ? `<ul class="matches">${matchHtml(next, s)}</ul>` : `<p class="muted small">${t('no_upcoming')}</p>`}</div></div></article>`;
  }
  function seriesCard(c, s) {
    const name = ((c.names && c.names[LANG]) || c.official_name).trim();
    const rows = (c.top || []).map(r => `<tr data-t="${r.id}"><td class="pos">${r.rank}</td><th scope="row" class="team">${U.team(s, r.id) ? `<a href="${U.team(s, r.id)}">${esc(r.name)}</a>` : esc(r.name)}</th><td class="dim">${r.played}</td><td class="pts">${r.points}</td><td class="c">${formPills(r.form)}</td></tr>`).join('');
    return `<article class="card scard"><div class="scard__top"><div><h3><a href="${U.series(s, c.public_id)}">${esc(name)}</a></h3><p>${esc(c.level)} · ${c.teams} ${t('teams_n')}</p></div><button type="button" class="pin pin--icon" data-pin="s:${c.public_id}">${icon('epingle-favori', 22)}</button></div>
      ${rows ? `<div class="tablewrap"><table class="tbl tbl--mini"><thead><tr><th class="pos">${t('pos')}</th><th class="l">${t('team')}</th><th>${t('pld')}</th><th>${t('pts')}</th><th class="c">${t('form')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}</article>`;
  }
  async function renderFavs(teamBox, seriesBox, limit) {
    if (!Fav.any()) return false;
    const [idx, s] = await Promise.all([load('index.json'), load('slugs.json')]);
    const teams = Fav.list('t').filter(id => s.t[id]).slice(0, limit || 99);
    const series = Fav.list('s').map(id => idx.competitions.find(c => c.public_id === id)).filter(Boolean).slice(0, limit || 99);
    const tc = await Promise.all(teams.map(id => teamCard(id, s).catch(() => '')));
    if (seriesBox) { teamBox.innerHTML = tc.join(''); seriesBox.innerHTML = series.map(c => seriesCard(c, s)).join(''); }
    else teamBox.innerHTML = tc.join('') + series.map(c => seriesCard(c, s)).join('');
    paintPins(document);
    return { teams: teams.length, series: series.length };
  }
  const favs = $('#favs');
  if (favs && Fav.any()) renderFavs($('#favgrid'), null, 4).then(r => { if (r && r.teams + r.series) favs.hidden = false; });
  if ($('#favteams')) {
    renderFavs($('#favgrid'), $('#favseriesgrid')).then(r => {
      if (!r) return;
      $('#fav-empty').hidden = r.teams + r.series > 0;
      $('#favteams').hidden = !r.teams;
      $('#favseries').hidden = !r.series;
    });
  }

  /* ---------------------------------------------------------------- résultats : filtres */
  const chips = $$('[data-resf]');
  if (chips.length) {
    const apply = k => {
      chips.forEach(c => c.setAttribute('aria-pressed', c.dataset.resf === k));
      const ft = new Set(Fav.list('t')), fs = new Set(Fav.list('s'));
      $$('.grid > [data-s]').forEach(card => {
        const fav = fs.has(card.dataset.s) || $$('.match', card).some(m => ft.has(m.dataset.h) || ft.has(m.dataset.a));
        card.hidden = !(k === 'all' || (k === 'fav' ? fav : card.dataset.r === k));
      });
    };
    chips.forEach(c => c.addEventListener('click', () => apply(c.dataset.resf)));
  }

  /* ---------------------------------------------------------------- fenêtre de forme 5 / 10 matchs (pages statistiques) */
  $$('[data-win]').forEach(b => b.tagName === 'BUTTON' && b.addEventListener('click', () => {
    const card = b.closest('.card') || document, w = b.dataset.win;
    $$('button[data-win]', card).forEach(x => { const on = x.dataset.win === w; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    $$('[data-winv]', card).forEach(v => { v.hidden = v.dataset.winv !== w; });
    $$('[data-chart="ppg"]', card).forEach(box => { box.dataset.win = w; if (window.Charts) draw(box).catch(() => {}); });
  }));

  /* ---------------------------------------------------------------- Belges à l'étranger : filtre de période (tout / week-end ven.–dim. / en semaine lun.–jeu.) */
  const belChips = $$('[data-belf]');
  if (belChips.length) {
    const applyBel = k => {
      belChips.forEach(c => c.setAttribute('aria-pressed', c.dataset.belf === k));
      $$('.js-belw tbody tr').forEach(tr => {
        const wd = +tr.dataset.wd;
        tr.hidden = !(k === 'all' || (k === 'we' ? wd >= 4 : wd <= 3));
      });
    };
    belChips.forEach(c => c.addEventListener('click', () => applyBel(c.dataset.belf)));
  }

  /* ---------------------------------------------------------------- mesure d'audience sans cookie (GoatCounter, si activé)
     Événements anonymes : temps de chargement (tranche LCP), passage d'un type de page à l'autre, clics des blocs de l'accueil. */
  const KIND = (body && body.dataset.kind) || 'other';
  const SEG = {};
  ['fr', 'nl', 'de'].forEach(l => { const d = D[l] || {}; ['series', 'team', 'club', 'results', 'tables', 'explore', 'myclub', 'belgians'].forEach(k => { if (d['seg_' + k]) SEG[d['seg_' + k]] = k; }); });
  function kindOf(path) {
    const p = path.replace(BASE, '').split('/').filter(Boolean);
    if (!p.length || !D[p[0]]) return 'other';
    if (p.length === 1) return 'home';
    const k = SEG[p[1]] || 'other';
    if (k === 'series' && p.length >= 4) return p[3] === D[p[0]].seg_stats ? 'stats' : p[3] === D[p[0]].seg_round ? 'round' : 'series';
    return k;
  }
  const kindKey = { home: 'home', myclub: 'myclub', series: 'series', stats: 'stats', round: 'round', team: 'team', club: 'club', results: 'results', tables: 'tables', explore: 'explore' };
  const pageKind = kindKey[KIND] || 'other';
  const queue = [];
  function track(path, title) {
    queue.push({ path, title, event: true });
    (function flush(n) {
      if (window.goatcounter && window.goatcounter.count) { while (queue.length) window.goatcounter.count(queue.shift()); }
      else if (n < 20) setTimeout(() => flush(n + 1), 500);
    })(0);
  }
  if (document.querySelector('script[data-goatcounter]')) {
    try {
      const ref = document.referrer && new URL(document.referrer);
      if (ref && ref.origin === location.origin) track(`flow/${kindOf(ref.pathname)}>${pageKind}`, 'Parcours');
    } catch (e) { /* référent illisible */ }
    let lcp = 0, sent = false;
    try { new PerformanceObserver(l => { const e = l.getEntries(); if (e.length) lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* navigateur sans LCP */ }
    const sendPerf = () => {
      if (sent) return; sent = true;
      const v = lcp || (performance.getEntriesByType('navigation')[0] || {}).loadEventEnd || 0;
      if (!v) return;
      const b = v < 1000 ? 'lt1s' : v < 2000 ? '1-2s' : v < 3000 ? '2-3s' : v < 5000 ? '3-5s' : 'gt5s';
      track(`perf/${pageKind}/${b}`, 'Chargement');
    };
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendPerf(); });
    setTimeout(sendPerf, 6000);
    $$('[data-block]').forEach(sec => sec.addEventListener('click', e => { if (e.target.closest('a')) track(`block/home/${sec.dataset.block}`, 'Accueil'); }));
  }

  /* ---------------------------------------------------------------- graphiques : redessin à la largeur réelle */
  const boxes = $$('[data-chart]');
  if (boxes.length && window.Charts && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target).catch(() => { /* le SVG statique reste affiché */ }); } }), { rootMargin: '200px' });
    boxes.forEach(b => io.observe(b));
  }
  async function draw(box) {
    const c = await load(box.dataset.series + '.json');
    const F = c.stats.form, tn = {}, byPid = {}; c.teams.forEach(x => { tn[x.id] = x.name; byPid[x.public_id] = x.id; });
    const fmt = v => (+v).toFixed(1);
    let series, labels, opts;
    if (box.dataset.chart === 'race') {
      const rows = c.standings.all.slice(0, 10);
      series = rows.map((r, i) => ({ name: r.name, values: c.stats.progression[r.team_id] || [], strong: i < 4, color: i < 4 ? Charts.SERIES[i] : null }));
      labels = c.stats.rounds.map(String); opts = { label: t('progression') };
    } else if (box.dataset.chart === 'ppg') {
      const ids = box.dataset.ids.split(',').map(p => byPid[p]).concat(Fav.list('t').map(p => byPid[p]).filter(Boolean)).filter((v, i, a) => v && a.indexOf(v) === i);
      const w10 = box.dataset.win === '10';
      series = ids.map((id, i) => ({ name: tn[id], values: F.teams[id].ppg.map(p => (w10 && p[2] != null) ? p[2] : p[1]), strong: true, color: Charts.SERIES[i % Charts.SERIES.length] }));
      labels = Array.from({ length: Math.max(...series.map(x => x.values.length)) }, (_, i) => String(i + 1)); opts = { max: 3, ticks: 3, fmt, label: t(w10 ? 'ppg_roll10' : 'ppg_roll') };
    } else if (box.dataset.chart === 'teamppg') {
      const P = F.teams[byPid[box.dataset.team]].ppg;
      series = [{ name: t('ppg_season'), values: P.map(p => p[0]), strong: true, color: '#F4F7FA' }, { name: t('ppg_5'), values: P.map(p => p[1]), strong: true, color: '#FFD447' }];
      labels = P.map((_, i) => String(i + 1)); opts = { max: 3, ticks: 3, fmt, label: t('ppg_chart') };
    } else return;
    box.innerHTML = '';
    Charts.lines(box, series, labels, opts);
  }
})();

/* Footbel — mini-graphiques SVG sans dépendance, couleurs du design system. */
window.Charts = (function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const C = { signal: '#FFD447', red: '#EF5662', text: '#F4F7FA', mute: '#6E7F92', faint: '#3A4C60' };
  const SERIES = [C.signal, C.text, C.red, '#8FB3D9', '#C7A26B', '#9DD0C4'];

  function el(tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(w, h, label) {
    const s = el('svg', { viewBox: `0 0 ${w} ${h}`, class: 'chart', role: 'img', preserveAspectRatio: 'xMinYMin meet' });
    if (label) s.setAttribute('aria-label', label);
    return s;
  }
  /* largeur réelle du conteneur → texte lisible sur mobile comme sur desktop */
  const width = (box, d) => { const cs = getComputedStyle(box); const w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return Math.round(w > 200 ? w : d); };
  const short = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  /* Courbes de points. series = [{name, values, color?, strong?}] ; labels = journées */
  function lines(box, series, labels, opts) {
    opts = opts || {};
    const W = width(box, 760), narrow = W < 520, H = narrow ? 260 : 320, P = { l: 30, r: narrow ? 104 : 136, t: 10, b: 26 };
    const s = svg(W, H, opts.label);
    const max = opts.max || Math.max(1, ...series.flatMap(x => x.values));
    const fmt = opts.fmt || (v => v);
    const n = Math.max(2, labels.length);
    const x = i => P.l + (W - P.l - P.r) * i / (n - 1);
    const y = v => H - P.b - (H - P.t - P.b) * v / max;
    const tk = opts.ticks || 4;
    for (let g = 0; g <= tk; g++) {
      const v = opts.max ? max * g / tk : Math.round(max * g / tk);
      s.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: 'grid' }));
      s.appendChild(el('text', { x: P.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, fmt(v)));
    }
    const step = Math.ceil(n / Math.max(4, Math.min(12, Math.floor((W - P.l - P.r) / 44))));
    labels.forEach((lb, i) => { if (i % step === 0 || i === n - 1) s.appendChild(el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, lb)); });
    const ends = [];
    series.slice().reverse().forEach(sr => {
      const col = sr.color || C.faint;
      const d = sr.values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
      const p = el('path', { d, fill: 'none', stroke: col, 'stroke-dasharray': sr.dash ? '5 5' : 'none', 'stroke-width': sr.strong ? 2.6 : 1.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      p.appendChild(el('title', {}, sr.name));
      s.appendChild(p);
      if (sr.strong && sr.values.length) ends.push({ y: y(sr.values[sr.values.length - 1]), name: sr.name, v: sr.values[sr.values.length - 1], col, x: x(sr.values.length - 1) });
    });
    ends.sort((a, b) => a.y - b.y);
    let last = -99;
    ends.forEach(e => {
      const yy = Math.max(e.y, last + 14); last = yy;
      s.appendChild(el('circle', { cx: e.x, cy: e.y, r: 3.5, fill: e.col }));
      s.appendChild(el('text', { x: e.x + 8, y: yy + 4, class: 'endlbl', fill: e.col, style: `fill:${e.col}` }, `${fmt(e.v)} ${short(e.name, narrow ? 12 : 17)}`));
    });
    box.appendChild(s);
  }

  /* Barres horizontales classées : rows = [{label, value, strong?}] */
  function hbars(box, rows, opts) {
    opts = opts || {};
    const W = width(box, 520), rh = 26, P = { l: Math.min(160, Math.round(W * 0.38)), r: 36 }, H = rows.length * rh + 4;
    const s = svg(W, H, opts.label);
    const max = Math.max(1, ...rows.map(r => r.value));
    rows.forEach((r, i) => {
      const w = (W - P.l - P.r) * r.value / max, yy = 2 + i * rh;
      s.appendChild(el('text', { x: P.l - 10, y: yy + 17, class: 'lbl', 'text-anchor': 'end' }, short(r.label, W < 420 ? 16 : 22)));
      s.appendChild(el('rect', { x: P.l, y: yy + 6, width: Math.max(2, w), height: rh - 12, rx: 3, fill: r.strong ? (opts.color || C.signal) : C.faint }));
      s.appendChild(el('text', { x: P.l + w + 8, y: yy + 17, class: 'val' }, r.value));
    });
    box.appendChild(s);
  }

  /* Barres verticales : rows = [{label, value}] */
  function vbars(box, rows, opts) {
    opts = opts || {};
    const W = width(box, 760), H = 200, P = { l: 30, r: 6, t: 10, b: 24 };
    const s = svg(W, H, opts.label);
    const max = Math.max(1, ...rows.map(r => r.value));
    const avg = rows.reduce((a, r) => a + r.value, 0) / Math.max(1, rows.length);
    const bw = (W - P.l - P.r) / Math.max(1, rows.length);
    const y = v => H - P.b - (H - P.t - P.b) * v / max;
    for (let g = 0; g <= 3; g++) {
      const v = Math.round(max * g / 3);
      s.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v), class: 'grid' }));
      s.appendChild(el('text', { x: P.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, v));
    }
    const step = Math.ceil(rows.length / Math.max(6, Math.floor(W / 40)));
    rows.forEach((r, i) => {
      const rc = el('rect', { x: P.l + i * bw + 1.5, y: y(r.value), width: Math.max(1, bw - 3), height: H - P.b - y(r.value), rx: 2, fill: r.value >= avg ? C.signal : C.faint });
      rc.appendChild(el('title', {}, `${r.label} : ${r.value}`));
      s.appendChild(rc);
      if (i % step === 0) s.appendChild(el('text', { x: P.l + i * bw + bw / 2, y: H - 6, 'text-anchor': 'middle' }, r.label));
    });
    s.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(avg), y2: y(avg), stroke: C.red, 'stroke-dasharray': '4 4', 'stroke-width': 1.2 }));
    box.appendChild(s);
  }

  return { lines, hbars, vbars, C, SERIES };
})();

/* Goalio depth. Load with defer, or place at the end of body. ES2017. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (/(?:^|[?&])no3d(?:[=&]|$)/.test(location.search)) return;
  try { if (localStorage.getItem('goalio.no3d') === '1') return; } catch (_) {}
  if (!window.matchMedia || root.classList.contains('js-3d')) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;

  function init() {
    if (reduced.matches) return;
    var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var slow = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
      (connection && connection.saveData);
    var enabled = true;
    var frame = 0;
    var scrollDirty = true;
    var active = null;
    var activeRect = null;
    var point = null;
    var observer = null;
    var headerObserver = null;
    var width = window.innerWidth;
    var resizeDirty = false;
    var headers = [];
    var pending = [];
    var blocked = '.tablewrap,table,.dash,.kpis,.pbar,.probs,[data-no3d],' +
      '[role="table"],[role="grid"],.chart,[data-chart],canvas,.split,.stat--rank,' +
      '[data-ranking],.ranking,.rankings,[role="progressbar"]';
    var passive = { passive: true };

    function safe(el) { return !el.closest(blocked) && !el.querySelector(blocked); }
    function layer(name, parent) {
      var el = document.createElement('span');
      el.className = name;
      el.setAttribute('aria-hidden', 'true');
      parent.appendChild(el);
      return el;
    }
    function listenMedia(query, fn) {
      if (query.addEventListener) query.addEventListener('change', fn, passive);
      else query.addListener(fn); // Safari before 14.
    }
    function pointerOK() { return enabled && !slow && fine.matches && !reduced.matches; }
    function reset() {
      if (!active) return;
      active.classList.remove('g3-hover');
      headers.forEach(function (h) {
        if (h.el === active && h.orbit) {
          h.orbit.style.removeProperty('--g3-ox');
          h.orbit.style.removeProperty('--g3-oy');
        }
      });
      ['--g3-rx', '--g3-ry', '--g3-lift'].forEach(function (key) {
        active.style.removeProperty(key);
      });
      active = null;
      activeRect = null;
      point = null;
    }
    function schedule() {
      if (enabled && !document.hidden && !frame) frame = requestAnimationFrame(paint);
    }
    function paint() {
      frame = 0;
      if (!enabled || reduced.matches) return;
      if (resizeDirty) {
        resizeDirty = false;
        if (width !== window.innerWidth) {
          width = window.innerWidth;
          reset();
          checkOrnaments();
          scrollDirty = true;
        }
      }
      var rect = active && point && pointerOK() ? activeRect : null;
      var positions = scrollDirty ? headers.map(function (h) {
        return { header: h, rect: h.el.getBoundingClientRect() };
      }) : [];
      scrollDirty = false;
      positions.forEach(function (item) {
        var r = item.rect;
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        var limit = Math.min(22, r.height * .04);
        var y = Math.max(-limit, Math.min(limit, -r.top * .09));
        if (item.header.img) item.header.img.style.setProperty('--g3-scroll', y.toFixed(2) + 'px');
      });
      if (!rect) return;
      var x = Math.max(0, Math.min(1, (point.x - rect.left) / (rect.width || 1)));
      var y = Math.max(0, Math.min(1, (point.y - rect.top) / (rect.height || 1)));
      var header = active.classList.contains('g3-header');
      var max = 8;
      if (!header) active.style.setProperty('--g3-rx', ((.5 - y) * max * 2).toFixed(2) + 'deg');
      if (!header) active.style.setProperty('--g3-ry', ((x - .5) * max * 2).toFixed(2) + 'deg');
      if (!header) {
        active.style.setProperty('--g3-lift', '-6px');
        var shine = active.querySelector('.g3-shine');
        shine.style.setProperty('--g3-x', (x * rect.width).toFixed(1) + 'px');
        shine.style.setProperty('--g3-y', (y * rect.height).toFixed(1) + 'px');
      }
      headers.forEach(function (h) {
        if (h.el !== active || !h.orbit) return;
        h.orbit.style.setProperty('--g3-ox', ((x - .5) * 28).toFixed(1) + 'px');
        h.orbit.style.setProperty('--g3-oy', ((y - .5) * 22).toFixed(1) + 'px');
      });
    }
    function checkOrnaments() {
      headers.forEach(function (h) {
        if (!h.orbit) return;
        // Visibility preserves geometry even when the previous check hid the ball.
        var ball = h.orbit.getBoundingClientRect();
        var overlap = Array.prototype.some.call(h.el.querySelectorAll('.ph__body > *'), function (el) {
          var r = el.getBoundingClientRect();
          return ball.width > 0 && r.width > 0 && r.height > 0 && ball.left - 20 < r.right && ball.right + 20 > r.left &&
            ball.top - 28 < r.bottom && ball.bottom + 20 > r.top;
        });
        h.orbit.classList.toggle('g3-obscured', overlap);
      });
    }
    function wire(el) {
      el.addEventListener('pointerenter', function (e) {
        if (!pointerOK() || e.pointerType === 'touch') return;
        if (active !== el) {
          reset();
          active = el;
          activeRect = el.getBoundingClientRect();
        }
        el.classList.add('g3-hover');
        point = { x: e.clientX, y: e.clientY };
        schedule();
      }, passive);
      el.addEventListener('pointermove', function (e) {
        if (active !== el || !pointerOK() || e.pointerType === 'touch') return;
        point = { x: e.clientX, y: e.clientY };
        schedule();
      }, passive);
      function leave(e) {
        if (e.type === 'pointerleave' && active === el && inside(e)) return;
        if (active === el) reset();
        headers.forEach(function (h) {
          if (h.el === el && h.orbit) {
            h.orbit.style.removeProperty('--g3-ox');
            h.orbit.style.removeProperty('--g3-oy');
          }
        });
      }
      el.addEventListener('pointerleave', leave, passive);
      el.addEventListener('pointercancel', leave, passive);
    }
    function inside(e) {
      return activeRect && e.clientX >= activeRect.left && e.clientX <= activeRect.right &&
        e.clientY >= activeRect.top && e.clientY <= activeRect.bottom;
    }

    root.classList.add('js-3d');
    if (!slow && fine.matches) root.classList.add('g3-pointer');
    document.querySelectorAll('.ph').forEach(function (el) {
      if (!safe(el)) return;
      el.classList.add('g3-header');
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      layer('g3-sweep', el);
      var body = el.querySelector('.ph__body');
      var orbit = null;
      if (document.body.getAttribute('data-kind') === 'home') {
        orbit = layer('g3-orbit', el);
        layer('g3-panels', layer('g3-ball', orbit));
      }
      headers.push({ el: el, body: body, orbit: orbit, img: el.querySelector('.ph__media img') });
      if (!slow) wire(el);
    });
    var cards = Array.prototype.filter.call(document.querySelectorAll('main article.card'), safe);
    cards.forEach(function (el) {
      el.classList.add('g3-card');
      var finish = layer('g3-finish', el);
      layer('g3-shine', finish);
      if (!slow) wire(el);
    });

    function show(el, immediate) {
      if (!el.classList.contains('g3-pending')) return;
      if (!immediate) {
        el.classList.add('g3-entering');
        function done(e) {
          if (e.target !== el) return;
          el.classList.remove('g3-entering');
          el.removeEventListener('transitionend', done);
          el.removeEventListener('transitioncancel', done);
        }
        el.addEventListener('transitionend', done);
        el.addEventListener('transitioncancel', done);
      } else el.classList.remove('g3-entering');
      el.classList.remove('g3-pending');
      if (observer) observer.unobserve(el);
    }
    if ('IntersectionObserver' in window) {
      try {
        observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) { if (entry.isIntersecting) show(entry.target); });
        }, { threshold: 0, rootMargin: '0px 0px 32px 0px' });
        pending = Array.prototype.filter.call(document.querySelectorAll('.sec'), function (el) {
          return safe(el) && !el.querySelector('article.card') && !el.parentElement.closest('.sec');
        }).concat(cards);
        var grids = new Map();
        cards.forEach(function (el) {
          var grid = el.closest('.grid');
          if (!grid) return;
          var index = grids.get(grid) || 0;
          el.style.setProperty('--g3-delay', Math.min(index, 6) * 60 + 'ms');
          grids.set(grid, index + 1);
        });
        pending.forEach(function (el) {
          // Keep initial viewport content visible, including direct anchor targets.
          var r = el.getBoundingClientRect();
          if ((r.top < window.innerHeight && r.bottom > 0) || el.contains(document.activeElement) ||
              el.matches(':target') || el.querySelector(':target')) return;
          observer.observe(el);
          el.classList.add('g3-reveal', 'g3-pending');
        });
      } catch (_) {
        if (observer) observer.disconnect();
        pending.forEach(function (el) { show(el, true); });
      }
    }
    document.addEventListener('focusin', function (e) {
      pending.forEach(function (el) { if (el.contains(e.target)) show(el, true); });
    }, passive);
    window.addEventListener('scroll', function () { reset(); scrollDirty = true; schedule(); }, passive);
    window.addEventListener('resize', function () { resizeDirty = true; schedule(); }, passive);
    // A transformed edge may emit leave while still inside the original card.
    window.addEventListener('pointermove', function (e) {
      if (active && !inside(e)) reset();
    }, passive);
    window.addEventListener('hashchange', function () {
      pending.forEach(function (el) {
        if (el.matches(':target') || el.querySelector(':target')) show(el, true);
      });
    }, passive);
    window.addEventListener('blur', reset, passive);
    document.addEventListener('visibilitychange', function () {
      root.classList.toggle('g3-paused', document.hidden || !!slow);
      if (document.hidden) { reset(); if (frame) cancelAnimationFrame(frame); frame = 0; }
      else { scrollDirty = true; schedule(); }
    }, passive);
    listenMedia(fine, function () {
      reset();
      root.classList.toggle('g3-pointer', pointerOK());
    });
    if (connection && connection.addEventListener) {
      connection.addEventListener('change', function () {
        if (connection.saveData) {
          slow = true; reset(); root.classList.remove('g3-pointer'); root.classList.add('g3-paused');
        }
      }, passive);
    }
    listenMedia(reduced, function () {
      if (!reduced.matches) return;
      enabled = false;
      reset();
      if (frame) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      if (headerObserver) headerObserver.disconnect();
      pending.forEach(function (el) { show(el, true); });
      root.classList.remove('js-3d', 'g3-pointer', 'g3-paused');
    });
    checkOrnaments();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(checkOrnaments);
    if ('ResizeObserver' in window) {
      var layoutObserver = new ResizeObserver(checkOrnaments);
      headers.forEach(function (h) { if (h.body) layoutObserver.observe(h.body); });
    }
    if ('IntersectionObserver' in window) {
      headerObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle('g3-paused', !entry.isIntersecting);
        });
      });
      headers.forEach(function (h) { headerObserver.observe(h.el); });
    }
    root.classList.toggle('g3-paused', document.hidden || !!slow);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true, passive: true });
  else init();
}());

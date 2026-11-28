/* Goalio — partage et retour (footbel/partage.py), 25/11/2026. Aucun script tiers, aucun traceur, aucun cookie.
   - boutons « Partager » : copie du lien, partage natif du téléphone (WhatsApp et Facebook sont de simples liens) ;
   - accueil : le club suivi passe en tête ; un nouveau visiteur est invité à suivre son équipe ;
   - invitation à installer Goalio sur l'écran d'accueil, montrée dans la page juste après « Suivre » (ou sur « Mon club »),
     jamais en fenêtre surgissante ; « Plus tard » est retenu 60 jours dans le stockage local du navigateur. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };
  const favs = () => { try { const d = JSON.parse(get('footbel.fav') || 'null'); return d && Array.isArray(d.t) && Array.isArray(d.s) ? d.t.length + d.s.length : 0; } catch (e) { return 0; } };

  /* ---------------------------------------------------------------- copie et partage natif */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* ancien navigateur : repli */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function done(btn) {
    const sp = $('span', btn); if (!sp) return;
    const old = sp.textContent;
    sp.textContent = btn.dataset.lDone || old; btn.classList.add('is-done');
    setTimeout(() => { sp.textContent = old; btn.classList.remove('is-done'); }, 2200);
  }
  $$('[data-share]').forEach(box => {
    const url = box.dataset.url, text = box.dataset.text;
    const nat = $('[data-share-native]', box);
    if (nat && navigator.share) {
      nat.hidden = false;
      nat.addEventListener('click', () => { navigator.share({ title: document.title, text, url }).catch(() => { /* partage annulé */ }); });
    }
    const cp = $('[data-share-copy]', box);
    if (cp) cp.addEventListener('click', () => copy(url).then(ok => { if (ok) done(cp); }));
    const cc = $('[data-cal-copy]', box);
    const cal = $('[data-cal]', box);
    if (cc && cal) cc.addEventListener('click', () => copy(cal.dataset.cal).then(ok => { if (ok) done(cc); }));
  });
  // abonnement plutôt qu'import : le lien https:// du calendrier devient webcal:// (iPhone, Mac, Outlook)
  $$('a[data-webcal]').forEach(a => { a.href = a.href.replace(/^https?:/, 'webcal:'); });

  /* ---------------------------------------------------------------- accueil : le club suivi d'abord, sinon l'invitation à suivre */
  const main = $('main');
  if (document.body.dataset.kind === 'home' && main) {
    const fv = $('#favs');
    if (favs() && fv) {
      const box = document.createElement('div');
      box.className = 'wrap favtop';
      box.appendChild(fv);
      main.insertBefore(box, main.firstChild);
    } else {
      const n = $('#favnudge'); if (n) n.hidden = false;
    }
  }

  /* ---------------------------------------------------------------- installation sur l'écran d'accueil */
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const later = () => { const v = Number(get('goalio.install') || 0); return v && Date.now() - v < 60 * 864e5; };
  const L = {"fr": {"install_t": "Goalio sur ton écran d’accueil", "install_p": "Ton club en un geste, comme une appli. Rien à télécharger, aucun compte.", "install_btn": "Installer", "install_no": "Plus tard", "install_ios": "Sur iPhone : touche Partager, puis « Sur l’écran d’accueil ».", "install_and": "Dans le menu du navigateur (⋮), choisis « Ajouter à l’écran d’accueil » ou « Installer l’application »."}, "nl": {"install_t": "Goalio op je beginscherm", "install_p": "Je club in één tik, zoals een app. Niets te downloaden, geen account.", "install_btn": "Installeren", "install_no": "Later", "install_ios": "Op iPhone: tik op Delen en dan op ‘Zet op beginscherm’.", "install_and": "Kies in het menu van je browser (⋮) ‘Toevoegen aan startscherm’ of ‘App installeren’."}, "de": {"install_t": "Goalio auf deinem Startbildschirm", "install_p": "Dein Verein mit einem Tippen, wie eine App. Kein Download, kein Konto.", "install_btn": "Installieren", "install_no": "Später", "install_ios": "Auf dem iPhone: Teilen und dann „Zum Home-Bildschirm“.", "install_and": "Im Browsermenü (⋮) „Zum Startbildschirm hinzufügen“ oder „App installieren“ wählen."}};
  const T = L[document.body.dataset.lang] || L.fr;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let deferred = null, shown = false;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', () => { put('goalio.install', String(Date.now() + 3650 * 864e5)); const b = $('.install'); if (b) b.remove(); });
  function invite() {
    if (shown || standalone() || later()) return;
    if (!main) return;
    shown = true;
    const node = document.createElement('section');
    node.className = 'install wrap'; node.setAttribute('role', 'region'); node.setAttribute('aria-label', T.install_t);
    node.innerHTML = `<div class="install__in"><img src="${document.body.dataset.base || ''}/partage/icon-192.png" width="48" height="48" alt="">` +
      `<div><h2 class="h3">${esc(T.install_t)}</h2><p>${esc(T.install_p)}</p><p class="install__how" hidden data-how="ios">${esc(T.install_ios)}</p>` +
      `<p class="install__how" hidden data-how="other">${esc(T.install_and)}</p></div><div class="install__act">` +
      `<button type="button" class="btn btn--signal" data-install-go>${esc(T.install_btn)}</button><button type="button" class="btn" data-install-no>${esc(T.install_no)}</button></div></div>`;
    const head = $(':scope > header.ph', main);
    if (head) head.after(node); else main.insertBefore(node, main.firstChild);
    $('[data-install-no]', node).addEventListener('click', () => { put('goalio.install', String(Date.now())); node.remove(); });
    $('[data-install-go]', node).addEventListener('click', ev => {
      if (deferred) {
        deferred.prompt();
        (deferred.userChoice || Promise.resolve({})).then(r => { if (r && r.outcome === 'accepted') node.remove(); });
        deferred = null;
        return;
      }
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const how = $('[data-how="' + (ios ? 'ios' : 'other') + '"]', node); if (how) how.hidden = false;
      ev.currentTarget.hidden = true;
    });
  }
  // après « Suivre » (le script principal met à jour aria-pressed au même clic)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pin]');
    if (b) setTimeout(() => { if (b.getAttribute('aria-pressed') === 'true') invite(); }, 0);
  });
  if (document.body.dataset.kind === 'myclub' && favs()) invite();
})();

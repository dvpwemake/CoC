/**
 * Daily logo rotation — deterministic pick from the logo pool by calendar day (America/New_York).
 * Same visitor sees the same mark all day; it changes at local ET midnight.
 */
(function (global) {
  'use strict';

  /** Light paper UI (index, legal) — avoid white-on-cream marks */
  var POOL_LIGHT = [
    'img/logo-mark.png',
    'img/logo-mark-dark.png',
    'img/logo-mark-gold.png',
    'img/CoC_logo_Blk.png'
  ];

  /** Dark editor chrome */
  var POOL_DARK = [
    'img/logo-mark.png',
    'img/logo-mark-gold.png',
    'img/CoC_logo_wh.png',
    'img/logo-mark-dark.png'
  ];

  function nyDateKey(d) {
    d = d || new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(d);
      var y, m, day;
      parts.forEach(function (p) {
        if (p.type === 'year') y = p.value;
        if (p.type === 'month') m = p.value;
        if (p.type === 'day') day = p.value;
      });
      return y + m + day; // YYYYMMDD
    } catch (e) {
      return (
        d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0')
      );
    }
  }

  function hashDay(key) {
    var h = 2166136261;
    for (var i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dayLogo(mode) {
    var pool = mode === 'dark' ? POOL_DARK : POOL_LIGHT;
    var idx = hashDay(nyDateKey()) % pool.length;
    return pool[idx];
  }

  /**
   * Set src on logo images. Optional linkHome wraps or uses parent <a href="index.html">.
   * @param {string|Element|NodeList} sel - CSS selector or element(s)
   * @param {{mode?:'light'|'dark', linkHome?:boolean}} opts
   */
  function applyDayLogo(sel, opts) {
    opts = opts || {};
    var mode = opts.mode || 'light';
    var src = dayLogo(mode);
    var nodes;
    if (typeof sel === 'string') nodes = document.querySelectorAll(sel);
    else if (sel && sel.nodeType === 1) nodes = [sel];
    else nodes = sel || [];
    Array.prototype.forEach.call(nodes, function (img) {
      if (!img || img.tagName !== 'IMG') return;
      img.src = src;
      img.setAttribute('data-logo-day', nyDateKey());
      img.alt = img.alt || 'Chronicle of Convergence';
      if (opts.linkHome) {
        var a = img.closest('a.logo-home');
        if (!a) {
          a = document.createElement('a');
          a.className = 'logo-home';
          a.href = 'index.html';
          a.setAttribute('aria-label', 'Home — Chronicle of Convergence');
          a.title = 'Home';
          img.parentNode.insertBefore(a, img);
          a.appendChild(img);
        } else {
          a.href = 'index.html';
          a.setAttribute('aria-label', 'Home — Chronicle of Convergence');
        }
      }
    });
    return src;
  }

  var api = {
    POOL_LIGHT: POOL_LIGHT,
    POOL_DARK: POOL_DARK,
    nyDateKey: nyDateKey,
    dayLogo: dayLogo,
    applyDayLogo: applyDayLogo
  };
  global.CoCLogoDay = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

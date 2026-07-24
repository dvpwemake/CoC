/**
 * CoC free analytics loader ($0).
 * Reads data/site-config.json — loads GA4 and/or Cloudflare Web Analytics only when IDs are set.
 * No paid products. Missing IDs = silent no-op (site still works).
 */
(function () {
  'use strict';
  function loadGa4(id) {
    if (!id || !/^G-[A-Z0-9]+$/i.test(id)) return;
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }
  function loadCfBeacon(token) {
    if (!token || token.length < 8) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: token }));
    document.head.appendChild(s);
  }
  function boot(cfg) {
    try {
      var a = (cfg && cfg.analytics) || {};
      loadGa4(String(a.ga4MeasurementId || '').trim());
      loadCfBeacon(String(a.cloudflareWebAnalyticsToken || '').trim());
    } catch (e) {
      /* ignore */
    }
  }
  fetch('data/site-config.json', { cache: 'no-cache' })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(boot)
    .catch(function () {
      /* offline / file:// */
    });
  // Relative path from /e/ pages
  if (location.pathname.indexOf('/e/') !== -1 || /\/e\/[^/]+\.html$/i.test(location.pathname)) {
    fetch('../data/site-config.json', { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (cfg) {
        if (cfg) boot(cfg);
      })
      .catch(function () {});
  }
})();

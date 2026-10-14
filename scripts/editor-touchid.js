/**
 * Touch ID unlock for the CoC editor (GitHub Pages, no server).
 *
 * Ported from the Fourth Wave editor (editor-touchid.js, commit 0b29257) with CoC's own names.
 * The GitHub token is sealed in this browser with an AES-GCM key that only a Touch ID check on
 * this device can produce (WebAuthn passkey + PRF extension -> HKDF-SHA-256 -> AES-GCM-256).
 * Nothing secret is stored in clear text and nothing is sent anywhere.
 *
 * Fallback: when the browser or device has no PRF support, the password gate works as before and
 * Publish asks for the token. If the passkey is deleted, the sealed token cannot be recovered:
 * sign in the other way and set Touch ID up again.
 */
(function (global) {
  'use strict';

  var VAULT_KEY = 'coc_touchid_vault_v1';
  var SKIP_KEY = 'coc_touchid_skip_v1';
  var SALT = new TextEncoder().encode('coc-editor-vault-v1');
  var INFO = new TextEncoder().encode('coc-editor-aes-gcm');
  var RP_NAME = 'Chronicle of Convergence editor';
  var PAT_RE = /^(ghp_|github_pat_)[A-Za-z0-9_]{20,255}$/;

  function b64u(buf) {
    var bytes = new Uint8Array(buf);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64u(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** Allow-list read: only the four known string fields come back, anything else is dropped. */
  function readVault() {
    try {
      var raw = localStorage.getItem(VAULT_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || typeof v.id !== 'string' || typeof v.iv !== 'string' || typeof v.ct !== 'string') return null;
      return { v: 1, id: v.id, iv: v.iv, ct: v.ct };
    } catch (e) {
      return null;
    }
  }

  function writeVault(v) {
    localStorage.setItem(VAULT_KEY, JSON.stringify({ v: 1, id: v.id, iv: v.iv, ct: v.ct }));
  }

  function enrolled() {
    return !!readVault();
  }

  function skipped() {
    try {
      return localStorage.getItem(SKIP_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setSkipped(on) {
    try {
      if (on) localStorage.setItem(SKIP_KEY, '1');
      else localStorage.removeItem(SKIP_KEY);
    } catch (e) { /* ignore */ }
  }

  function validToken(pat) {
    return PAT_RE.test(String(pat || '').trim());
  }

  async function supported() {
    try {
      if (!global.PublicKeyCredential || !navigator.credentials) return false;
      if (!global.isSecureContext) return false;
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      return false;
    }
  }

  async function aesKeyFrom(prfBytes) {
    var base = await crypto.subtle.importKey('raw', prfBytes, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: INFO },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function prfFirst(cred) {
    var ext = cred && cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
    var first = ext && ext.prf && ext.prf.results && ext.prf.results.first;
    return first ? new Uint8Array(first) : null;
  }

  // One Touch ID check that returns the PRF secret for an existing passkey.
  async function prfFor(idBytes) {
    var cred = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: idBytes }],
        userVerification: 'required',
        timeout: 60000,
        extensions: { prf: { eval: { first: SALT } } }
      }
    });
    var first = prfFirst(cred);
    if (!first) throw new Error('prf_unavailable');
    return first;
  }

  // New passkey. Some browsers return the PRF secret at creation; then no second Touch ID is needed.
  async function createPasskey() {
    var cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: RP_NAME, id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'coc-editor', displayName: 'CoC Editor' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        extensions: { prf: { eval: { first: SALT } } }
      }
    });
    var ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
    if (!ext.prf || !ext.prf.enabled) throw new Error('prf_unavailable');
    return { id: new Uint8Array(cred.rawId), prf: prfFirst(cred) };
  }

  async function seal(prfBytes, secret) {
    var key = await aesKeyFrom(prfBytes);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(secret)));
    return { iv: b64u(iv), ct: b64u(ct) };
  }

  function failMessage(e, what) {
    if (e && e.message === 'prf_unavailable') {
      return 'This browser or device cannot protect the token with Touch ID (no PRF support). Keep using the password.';
    }
    if (e && e.name === 'NotAllowedError') {
      return 'Touch ID was cancelled, or the passkey for this site is gone. Try again, or use the other way to sign in.';
    }
    return what + ' failed: ' + (e && e.name ? e.name : 'error') + '.';
  }

  /**
   * Seal the token. fresh=true always makes a new passkey (first setup, or the old one was deleted);
   * otherwise the saved passkey is reused (replace the token). Returns { ok, message, noPrf }.
   */
  async function save(pat, fresh) {
    pat = String(pat || '').trim();
    if (!validToken(pat)) {
      return { ok: false, message: 'That does not look like a GitHub token (ghp_… or github_pat_…).' };
    }
    if (!(await supported())) {
      return { ok: false, message: 'Touch ID is not available in this browser. The password still works.' };
    }
    try {
      var vault = fresh ? null : readVault();
      var idBytes;
      var prf = null;
      if (vault) {
        idBytes = fromB64u(vault.id);
      } else {
        var made = await createPasskey();
        idBytes = made.id;
        prf = made.prf;
      }
      if (!prf) prf = await prfFor(idBytes);
      var sealed = await seal(prf, { pat: pat });
      writeVault({ id: b64u(idBytes), iv: sealed.iv, ct: sealed.ct });
      setSkipped(false);
      return { ok: true };
    } catch (e) {
      return { ok: false, noPrf: !!(e && e.message === 'prf_unavailable'), message: failMessage(e, 'Touch ID setup') };
    }
  }

  /** One Touch ID check. Returns { ok, pat } or { ok: false, message }. */
  async function unlock() {
    var vault = readVault();
    if (!vault) return { ok: false, message: 'Touch ID is not set up on this browser.' };
    try {
      var prf = await prfFor(fromB64u(vault.id));
      var key = await aesKeyFrom(prf);
      var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64u(vault.iv) }, key, fromB64u(vault.ct));
      var data = JSON.parse(new TextDecoder().decode(plain));
      if (!data || !validToken(data.pat)) {
        return { ok: false, message: 'The saved token is not usable. Use the other way to sign in and set Touch ID up again.' };
      }
      return { ok: true, pat: String(data.pat).trim() };
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.message === 'prf_unavailable')) return { ok: false, message: failMessage(e, 'Touch ID') };
      return { ok: false, message: 'Touch ID could not open the saved token. Use the other way to sign in and set Touch ID up again.' };
    }
  }

  function forget() {
    try {
      localStorage.removeItem(VAULT_KEY);
    } catch (e) { /* ignore */ }
  }

  /**
   * Check the token against GitHub before sealing it (10 s timeout; nothing logged).
   * Only the HTTP status is read; the token never leaves the Authorization header.
   */
  async function checkToken(pat) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 10000) : null;
    try {
      var res = await fetch('https://api.github.com/repos/dvpwemake/CoC', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + String(pat).trim(),
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: ctl ? ctl.signal : undefined
      });
      if (res.ok) return { ok: true };
      if (res.status === 401) return { ok: false, message: 'GitHub rejected that token (401). Check it and try again.' };
      if (res.status === 403 || res.status === 404) return { ok: false, message: 'That token cannot see dvpwemake/CoC (' + res.status + '). Give it access to the CoC repo.' };
      return { ok: false, message: 'GitHub answered ' + res.status + '. Try again in a moment.' };
    } catch (e) {
      return { ok: false, message: 'Could not reach GitHub to check the token. Try again in a moment.' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  global.CoCTouchID = {
    supported: supported,
    enrolled: enrolled,
    skipped: skipped,
    setSkipped: setSkipped,
    validToken: validToken,
    checkToken: checkToken,
    save: save,
    unlock: unlock,
    forget: forget
  };
})(window);

// Editor sidebar panel: shown only where Touch ID is available.
document.addEventListener('DOMContentLoaded', async function () {
  var box = document.getElementById('touchIdBox');
  var T = window.CoCTouchID;
  if (!box || !T || !(await T.supported())) return;
  var state = document.getElementById('touchIdState');
  var saveBtn = document.getElementById('touchIdSave');
  var forgetBtn = document.getElementById('touchIdForget');
  function currentToken() {
    try {
      return window.CocGitHubPublish ? CocGitHubPublish.getToken() : '';
    } catch (e) {
      return '';
    }
  }
  function paint(msg) {
    var on = T.enrolled();
    state.textContent = msg || (on
      ? 'On. Sign in with one Touch ID; no password, no token paste.'
      : 'Off. Publish once (it asks for the GitHub token), then save the token here.');
    saveBtn.textContent = on ? 'Replace saved token (Touch ID)' : 'Use Touch ID next time';
    forgetBtn.hidden = !on;
    box.hidden = false;
  }
  saveBtn.addEventListener('click', async function () {
    var pat = currentToken();
    if (!pat) {
      paint('No GitHub token in this session yet. Publish once (it asks for the token), then come back here.');
      return;
    }
    saveBtn.disabled = true;
    var res = await T.save(pat, !T.enrolled());
    saveBtn.disabled = false;
    paint(res.ok ? 'Saved. Next time, sign in with Touch ID.' : res.message);
  });
  forgetBtn.addEventListener('click', function () {
    T.forget();
    paint('Touch ID removed from this browser. Sign in with the password next time.');
  });
  paint();
});

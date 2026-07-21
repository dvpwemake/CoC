/**
 * Editor gate for static hosting (GitHub Pages).
 * Compares SHA-256 of entered password to passwordSha256 below.
 * This is a deterrence layer — not equivalent to server auth / Cloudflare Access.
 * Rotate: node -e "crypto.createHash('sha256').update('NEW_PASSWORD').digest('hex')"
 */
(function (global) {
  'use strict';

  var CONFIG = {
    // sha256("CoCEdit!Lynch2026") — change after first login via this file
    passwordSha256: '02d02f3a1c615f009beb47f11f896bd5efe497112dc427ae268b7ab2f402ae6c',
    sessionKey: 'coc_editor_session_v1',
    failKey: 'coc_editor_fails_v1',
    maxFails: 8,
    lockMinutes: 15
  };

  function bufToHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(function (b) {
        return b.toString(16).padStart(2, '0');
      })
      .join('');
  }

  async function sha256(text) {
    var data = new TextEncoder().encode(text);
    var dig = await crypto.subtle.digest('SHA-256', data);
    return bufToHex(dig);
  }

  function failState() {
    try {
      return JSON.parse(sessionStorage.getItem(CONFIG.failKey) || '{"n":0,"until":0}');
    } catch (e) {
      return { n: 0, until: 0 };
    }
  }

  function setFails(s) {
    sessionStorage.setItem(CONFIG.failKey, JSON.stringify(s));
  }

  function isLocked() {
    var s = failState();
    return s.until && Date.now() < s.until;
  }

  function recordFail() {
    var s = failState();
    s.n = (s.n || 0) + 1;
    if (s.n >= CONFIG.maxFails) {
      s.until = Date.now() + CONFIG.lockMinutes * 60 * 1000;
      s.n = 0;
    }
    setFails(s);
    return s;
  }

  function clearFails() {
    sessionStorage.removeItem(CONFIG.failKey);
  }

  function hasSession() {
    try {
      return sessionStorage.getItem(CONFIG.sessionKey) === CONFIG.passwordSha256;
    } catch (e) {
      return false;
    }
  }

  function setSession() {
    sessionStorage.setItem(CONFIG.sessionKey, CONFIG.passwordSha256);
    clearFails();
  }

  function clearSession() {
    sessionStorage.removeItem(CONFIG.sessionKey);
  }

  async function tryLogin(password) {
    if (isLocked()) {
      var s = failState();
      var mins = Math.ceil((s.until - Date.now()) / 60000);
      return { ok: false, error: 'Too many attempts. Try again in ~' + mins + ' min.' };
    }
    var h = await sha256(String(password || ''));
    if (h === CONFIG.passwordSha256) {
      setSession();
      return { ok: true };
    }
    recordFail();
    return { ok: false, error: 'Incorrect password.' };
  }

  /**
   * Mount gate UI; on success call onOk and hide gate.
   */
  function showApp(gate, app) {
    if (gate) gate.setAttribute('hidden', '');
    if (app) app.removeAttribute('hidden');
    document.documentElement.classList.add('editor-unlocked');
  }

  function mountGate(onOk) {
    var gate = document.getElementById('editorGate');
    var app = document.getElementById('editorApp');

    if (hasSession()) {
      showApp(gate, app);
      if (typeof onOk === 'function') onOk();
      return;
    }

    if (app) app.setAttribute('hidden', '');
    if (!gate) {
      // Fail closed if gate markup missing
      if (app) app.setAttribute('hidden', '');
      return;
    }

    gate.removeAttribute('hidden');
    var form = gate.querySelector('#gateForm');
    var input = gate.querySelector('#gatePass');
    var err = gate.querySelector('#gateErr');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (err) err.textContent = '';
      tryLogin(input && input.value).then(function (res) {
        if (res.ok) {
          showApp(gate, app);
          if (typeof onOk === 'function') onOk();
        } else {
          if (err) err.textContent = res.error || 'Access denied';
          if (input) {
            input.value = '';
            input.focus();
          }
        }
      });
    });

    if (input) setTimeout(function () { input.focus(); }, 50);
  }

  global.CoCEditorAuth = {
    CONFIG: CONFIG,
    hasSession: hasSession,
    tryLogin: tryLogin,
    clearSession: clearSession,
    mountGate: mountGate,
    isLocked: isLocked
  };
})(typeof window !== 'undefined' ? window : globalThis);

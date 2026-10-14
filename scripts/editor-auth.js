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

    // Touch ID (scripts/editor-touchid.js): one touch signs in and loads the GitHub token.
    var tid = global.CoCTouchID;
    var tidBox = gate.querySelector('#gateTid');
    var tidBtn = gate.querySelector('#gateTidBtn');
    var other = gate.querySelector('#gateOther');
    var setup = gate.querySelector('#gateSetup');
    var setupPat = gate.querySelector('#gateSetupPat');
    var setupBtn = gate.querySelector('#gateSetupBtn');
    var setupSkip = gate.querySelector('#gateSetupSkip');
    var usedFallback = false;

    function enter() {
      showApp(gate, app);
      if (typeof onOk === 'function') onOk();
    }

    function passwordView() {
      if (tidBox) tidBox.setAttribute('hidden', '');
      form.removeAttribute('hidden');
      if (input) setTimeout(function () { input.focus(); }, 50);
    }

    function setToken(pat) {
      try {
        if (global.CocGitHubPublish) global.CocGitHubPublish.setToken(pat);
      } catch (e) { /* private mode: Publish will ask for the token */ }
    }

    // After a password sign-in on a Touch ID device: offer "Use Touch ID next time" once.
    function afterPassword() {
      if (!tid || !setup || !setupBtn) return Promise.resolve(enter());
      if (tid.enrolled() ? !usedFallback : tid.skipped()) return Promise.resolve(enter());
      return tid.supported().then(function (ok) {
        if (!ok) return enter();
        form.setAttribute('hidden', '');
        setup.removeAttribute('hidden');
        if (err) err.textContent = '';
        if (setupPat) {
          var have = '';
          try { have = global.CocGitHubPublish ? global.CocGitHubPublish.getToken() : ''; } catch (e) { have = ''; }
          setupPat.value = have;
          setTimeout(function () { setupPat.focus(); }, 50);
        }
      });
    }

    if (tid && tidBox && tidBtn && tid.enrolled()) {
      // Enrolled: Touch ID is the sign-in; the password form waits behind "Other way to sign in".
      form.setAttribute('hidden', '');
      tidBox.removeAttribute('hidden');
      tid.supported().then(function (ok) {
        if (!ok) passwordView();
      });
      tidBtn.addEventListener('click', function () {
        if (err) err.textContent = '';
        tidBtn.disabled = true;
        tid.unlock().then(function (res) {
          tidBtn.disabled = false;
          if (res.ok) {
            setToken(res.pat);
            setSession();
            enter();
          } else if (err) {
            err.textContent = res.message || 'Touch ID failed.';
          }
        });
      });
      if (other) {
        other.addEventListener('click', function () {
          usedFallback = true;
          if (err) err.textContent = '';
          passwordView();
        });
      }
    }

    if (setupBtn && tid) {
      setupBtn.addEventListener('click', function () {
        var pat = setupPat ? String(setupPat.value || '').trim() : '';
        if (err) err.textContent = '';
        if (!tid.validToken(pat)) {
          if (err) err.textContent = 'Paste a GitHub token (ghp_… or github_pat_…).';
          return;
        }
        setupBtn.disabled = true;
        if (err) err.textContent = 'Checking the token with GitHub…';
        tid.checkToken(pat).then(function (chk) {
          if (!chk.ok) return chk;
          if (err) err.textContent = 'Touch ID…';
          return tid.save(pat, true);
        }).then(function (res) {
          setupBtn.disabled = false;
          if (res.ok) {
            if (setupPat) setupPat.value = '';
            if (err) err.textContent = '';
            setToken(pat);
            enter();
            return;
          }
          if (res.noPrf) {
            tid.setSkipped(true);
            setupBtn.setAttribute('hidden', '');
            if (setupSkip) setupSkip.textContent = 'Continue to the editor';
          }
          if (err) err.textContent = res.message || 'Touch ID setup failed.';
        });
      });
    }
    if (setupSkip) {
      setupSkip.addEventListener('click', function () {
        if (tid && !tid.enrolled()) tid.setSkipped(true);
        if (setupPat) setupPat.value = '';
        enter();
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (err) err.textContent = '';
      tryLogin(input && input.value).then(function (res) {
        if (res.ok) {
          if (input) input.value = '';
          afterPassword();
        } else {
          if (err) err.textContent = res.error || 'Access denied';
          if (input) {
            input.value = '';
            input.focus();
          }
        }
      });
    });

    if (input && !form.hasAttribute('hidden')) setTimeout(function () { input.focus(); }, 50);
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

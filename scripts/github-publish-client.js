'use strict';
/**
 * Browser-safe GitHub Contents API helpers for CoC editor "Publish Editorial".
 * Token stays in sessionStorage only (never committed).
 */
(function (root) {
  const OWNER = 'dvpwemake';
  const REPO = 'CoC';
  const BRANCH = 'main';
  const TOKEN_KEY = 'coc_gh_publish_token';

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }
  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* ignore */ }
  }

  async function api(path, opts) {
    opts = opts || {};
    const token = opts.token || getToken();
    if (!token) throw new Error('GitHub token required (repo scope). Enter once when publishing.');
    const res = await fetch('https://api.github.com' + path, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg = (data && (data.message || data.error)) || res.statusText || 'GitHub API error';
      throw new Error(msg + (data && data.errors ? ' · ' + JSON.stringify(data.errors) : ''));
    }
    return data;
  }

  function b64EncodeUtf8(str) {
    // Unicode-safe base64
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin);
  }

  function b64DecodeUtf8(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  async function getFile(path) {
    const data = await api(
      '/repos/' + OWNER + '/' + REPO + '/contents/' + encodeURI(path) + '?ref=' + encodeURIComponent(BRANCH)
    );
    if (!data || !data.content) throw new Error('Empty content for ' + path);
    return { sha: data.sha, text: b64DecodeUtf8(data.content), path };
  }

  async function putFile(path, text, sha, message) {
    return api('/repos/' + OWNER + '/' + REPO + '/contents/' + encodeURI(path), {
      method: 'PUT',
      body: {
        message: message,
        content: b64EncodeUtf8(text),
        branch: BRANCH,
        sha: sha
      }
    });
  }

  /**
   * Inject slim EMBEDDED_EDITORIAL into index.html source.
   */
  function injectEmbeddedEditorial(html, ed) {
    const slim = Object.assign({}, ed);
    delete slim.headlines;
    if (slim.paragraphs && slim.paragraphs.length) delete slim.body;
    const payload = 'const EMBEDDED_EDITORIAL = ' + JSON.stringify(slim, null, 2) + ';';
    const re = /const\s+EMBEDDED_EDITORIAL\s*=\s*\{[\s\S]*?\n\};/m;
    if (re.test(html)) return html.replace(re, () => payload);
    if (/const\s+EMBEDDED_DATA\s*=/.test(html)) {
      return html.replace(/const\s+EMBEDDED_DATA\s*=/, payload + '\n\nconst EMBEDDED_DATA =');
    }
    throw new Error('Could not find EMBEDDED_EDITORIAL in index.html');
  }

  /**
   * Inject latest batch into EMBEDDED_DATA (optional, when archive head changes).
   */
  function injectEmbeddedDataHead(html, headBatch) {
    const marker = 'const EMBEDDED_DATA = ';
    const start = html.indexOf(marker);
    if (start < 0) return html;
    const sub = html.slice(start + marker.length);
    let depth = 0;
    let end = -1;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] === '[') depth++;
      else if (sub[i] === ']') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end < 0) return html;
    const next = JSON.stringify([headBatch], null, 2);
    return html.slice(0, start + marker.length) + next + html.slice(start + marker.length + end);
  }

  root.CocGitHubPublish = {
    OWNER,
    REPO,
    BRANCH,
    TOKEN_KEY,
    getToken,
    setToken,
    getFile,
    putFile,
    injectEmbeddedEditorial,
    injectEmbeddedDataHead,
    b64EncodeUtf8,
    b64DecodeUtf8
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);

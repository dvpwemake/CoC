'use strict';
/**
 * Editor controls for the daily LinkedIn company-page post.
 * The token stays in GitHub Actions secrets. This file only queues a workflow.
 */
(function (root) {
  const WORKFLOW = 'linkedin-editorial.yml';

  function toast(msg, kind) {
    if (typeof root.toast === 'function') root.toast(msg, kind);
  }
  function addLog(kind, msg) {
    if (typeof root.addLog === 'function') root.addLog(kind, msg);
  }

  async function refreshLinkedInStatus() {
    const el = document.getElementById('liStatus');
    if (!el || !root.CocGitHubPublish) return;
    const dateInput = document.getElementById('liDate');
    if (dateInput && !dateInput.value && typeof root.todayET === 'function') {
      dateInput.value = root.todayET();
    }
    let ledger = null;
    let runs = null;
    try {
      const file = await root.CocGitHubPublish.getFile('data/linkedin-posts.json');
      ledger = JSON.parse(file.text);
    } catch (e) {
      ledger = null;
    }
    try {
      runs = await root.CocGitHubPublish.workflowRuns(WORKFLOW);
    } catch (e) {
      runs = null;
    }
    const last = ledger && ledger.posts && ledger.posts[0];
    const run = runs && runs.workflow_runs && runs.workflow_runs[0];
    const parts = [];
    parts.push(last
      ? ('Last post ' + last.date + ' · ' + (last.title || 'editorial'))
      : 'No company-page post recorded yet.');
    if (run) {
      parts.push('Latest run ' + run.status + (run.conclusion ? ' / ' + run.conclusion : ''));
    }
    el.textContent = parts.join(' ');
  }

  async function postEditorialToLinkedIn(date, opts) {
    const quiet = !!(opts && opts.quiet);
    const input = document.getElementById('liDate');
    const chosen = String(date || (input && input.value) || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chosen)) {
      toast('Use a date like 2026-10-14', 'warning');
      return;
    }
    const btn = document.getElementById('liPostBtn');
    if (btn) btn.disabled = true;
    try {
      if (!root.CocGitHubPublish || !root.CocGitHubPublish.getToken()) {
        toast('GitHub token required. Publish an editorial once this session, then try again.', 'warning');
        return;
      }
      const delay = opts && opts.delayMinutes === 10 ? '10' : '0';
      await root.CocGitHubPublish.dispatchWorkflow(WORKFLOW, {
        date: chosen,
        delay_minutes: delay
      });
      const when = delay === '10' ? '10 minutes after this publish' : 'now';
      addLog('ok', 'LinkedIn queued for ' + chosen + ' · ' + when);
      if (!quiet) {
        toast('LinkedIn post queued for ' + chosen + '. It goes out ' + when + '.', 'success');
      }
      setTimeout(refreshLinkedInStatus, 4000);
    } catch (e) {
      const msg = (e && e.message) || 'LinkedIn queue failed';
      addLog('er2', 'LinkedIn queue failed: ' + msg);
      toast((quiet ? 'Editorial is on GitHub. LinkedIn was not queued. ' : '') + msg, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  root.refreshLinkedInStatus = refreshLinkedInStatus;
  root.postEditorialToLinkedIn = postEditorialToLinkedIn;
})(typeof globalThis !== 'undefined' ? globalThis : window);

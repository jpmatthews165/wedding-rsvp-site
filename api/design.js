// POST /api/design — design changes (code) requested from the website editor.
// Admins only. Talks to GitHub with a token limited to this repo:
//   { action: 'create',  request, followUpOf? }   → starts the "Design change" workflow
//   { action: 'list' }                             → recent requests with live status
//   { action: 'approve', id }                      → merges the change into main (goes live)
//   { action: 'discard', id }                      → closes it and deletes its branch
//
// Required Vercel environment variables:
//   GITHUB_DESIGN_TOKEN — fine-grained token for this repo with Actions, Contents
//                         and Pull requests: read & write (Metadata: read).
// Optional: GITHUB_REPO (default jpmatthews165/wedding-rsvp-site),
//           VERCEL_AUTOMATION_BYPASS_SECRET (set automatically when Vercel's
//           "Protection Bypass for Automation" is on) so previews open without a Vercel login.
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdminToken, bearerToken } from './_admin.js';
import { getDb, readJsonBody } from './_lib.js';

const REPO = process.env.GITHUB_REPO || 'jpmatthews165/wedding-rsvp-site';
const WORKFLOW = 'design-change.yml';
const COLLECTION = 'designRequests';

const gh = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_DESIGN_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'wedding-site-editor',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.message || `GitHub error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
};

const withBypass = (url) => {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!url || !secret) return url;
  return `${url}${url.includes('?') ? '&' : '?'}x-vercel-protection-bypass=${encodeURIComponent(secret)}&x-vercel-set-bypass-cookie=samesitenone`;
};

const dispatch = (doc, attempt, request, followUp) => gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
  method: 'POST',
  body: {
    ref: 'main',
    inputs: {
      request_id: doc.id,
      attempt: String(attempt),
      request,
      requested_by: doc.by,
      branch: doc.branch,
      follow_up: followUp ? 'true' : 'false',
    },
  },
});

// Works out where a request is now: working → ready (with preview) → published/discarded, or failed.
const refresh = async (ref, d) => {
  if (['published', 'discarded'].includes(d.state)) return d;
  const update = {};

  // 1. Latest workflow run for this request's latest attempt.
  const runs = await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&per_page=40`);
  // Title format is "design <id> attempt <n>"; older runs were titled just "design <id>".
  const run = runs.workflow_runs.find((r) => r.display_title === `design ${d.id} attempt ${d.attempt}`)
    || (d.attempt === 1 ? runs.workflow_runs.find((r) => r.display_title === `design ${d.id}`) : null);
  if (!run) {
    // GitHub takes a few seconds to list a newly started run.
    update.state = 'working';
  } else if (run.status !== 'completed') {
    update.state = 'working';
    update.runUrl = run.html_url;
  } else if (run.conclusion !== 'success') {
    update.state = 'failed';
    update.runUrl = run.html_url;
    let reason = 'Something went wrong while making this change.';
    try {
      const jobs = await gh(`/repos/${REPO}/actions/runs/${run.id}/jobs`);
      for (const job of jobs.jobs) {
        const notes = await gh(`/repos/${REPO}/check-runs/${job.id}/annotations`);
        const hit = notes.find((a) => /^Design change/.test(a.title || ''));
        if (hit) {
          reason = hit.message.replace(/^No changes were made\.\s*/, '').replace(/^(OUT_OF_SCOPE|CONTENT_ONLY):\s*/, '');
          if (/not logged in|\/login|api key/i.test(reason)) reason = "Claude couldn't sign in on GitHub (the API key secret is missing or invalid). Josh needs to check the ANTHROPIC_API_KEY secret, then use Redo.";
          break;
        }
      }
    } catch { /* keep generic reason */ }
    update.reason = reason;
  } else {
    // 2. The change is on its branch: make sure there's a pull request.
    let pr = null;
    if (d.prNumber) pr = await gh(`/repos/${REPO}/pulls/${d.prNumber}`);
    if (!pr) {
      const owner = REPO.split('/')[0];
      const open = await gh(`/repos/${REPO}/pulls?state=all&head=${owner}:${encodeURIComponent(d.branch)}`);
      pr = open[0] || await gh(`/repos/${REPO}/pulls`, {
        method: 'POST',
        body: {
          title: `Design: ${d.text.slice(0, 70)}`,
          head: d.branch,
          base: 'main',
          body: `Requested by ${d.by} from the website editor.\n\n> ${d.text.replace(/\n/g, '\n> ')}\n\nApprove or discard it in the editor (Ask Claude → Design changes).`,
        },
      });
      update.prNumber = pr.number;
      update.prUrl = pr.html_url;
    }
    if (pr.merged_at) update.state = 'published';
    else if (pr.state === 'closed') update.state = 'discarded';
    else {
      // 3. Vercel's preview for the branch's latest commit.
      const commit = await gh(`/repos/${REPO}/commits/${pr.head.sha}`);
      update.summary = commit.commit.message.split('\n\n').slice(2).join('\n\n').replace(/\n*Co-Authored-By:.*$/s, '').trim() || d.summary || '';
      const deps = await gh(`/repos/${REPO}/deployments?sha=${pr.head.sha}&per_page=5`);
      let state = 'building';
      for (const dep of deps) {
        const statuses = await gh(`/repos/${REPO}/deployments/${dep.id}/statuses?per_page=5`);
        const s = statuses[0];
        if (s?.state === 'success' && s.environment_url) { state = 'ready'; update.previewUrl = s.environment_url; break; }
        if (s && ['failure', 'error'].includes(s.state)) { state = 'failed'; update.reason = 'The preview failed to build.'; }
      }
      if (state === 'building') {
        // Fallback: Vercel's commit status plus its predictable branch preview address.
        const combined = await gh(`/repos/${REPO}/commits/${pr.head.sha}/status`);
        const vercel = combined.statuses.find((x) => /vercel/i.test(x.context));
        if (vercel?.state === 'success') {
          state = 'ready';
          const [owner, name] = REPO.split('/');
          update.previewUrl = `https://${name}-git-${d.branch.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${owner.toLowerCase()}.vercel.app`;
        } else if (vercel?.state === 'failure' || vercel?.state === 'error') {
          state = 'failed';
          update.reason = 'The preview failed to build.';
        }
      }
      update.state = state;
    }
  }
  if (Object.keys(update).length) await ref.set({ ...update, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ...d, ...update };
};

const publicView = (d) => ({
  id: d.id, text: d.text, by: d.by, state: d.state, attempt: d.attempt,
  history: d.history || [], reason: d.reason || '', summary: d.summary || '',
  previewUrl: withBypass(d.previewUrl || ''), prUrl: d.prUrl || '', runUrl: d.runUrl || '',
  createdAt: d.createdAt?.toMillis?.() || null,
});

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  res.setHeader('Cache-Control', 'no-store');

  let user;
  try { user = await verifyAdminToken(bearerToken(req)); } catch { return res.status(401).json({ error: 'Please sign in again.' }); }
  if (!process.env.GITHUB_DESIGN_TOKEN) return res.status(500).json({ error: 'Design changes aren’t set up yet (missing GITHUB_DESIGN_TOKEN in Vercel).' });

  const body = readJsonBody(req);
  const col = getDb().collection(COLLECTION);

  try {
    if (body.action === 'create') {
      const request = String(body.request || '').trim();
      if (request.length < 5 || request.length > 2000) return res.status(400).json({ error: 'Describe the change in 5–2000 characters.' });

      if (body.followUpOf) {
        const ref = col.doc(String(body.followUpOf));
        const snap = await ref.get();
        if (!snap.exists) return res.status(404).json({ error: 'Request not found.' });
        const d = snap.data();
        if (['published', 'discarded'].includes(d.state)) return res.status(400).json({ error: 'That change is already finished. Start a new request.' });
        const attempt = (d.attempt || 1) + 1;
        const combined = `Original request: ${d.text}\n\nFollow-up from ${user.email}: ${request}`;
        await dispatch({ ...d, by: user.email }, attempt, combined, true);
        await ref.set({ attempt, state: 'working', reason: '', previewUrl: '', history: FieldValue.arrayUnion({ text: request, by: user.email, at: Date.now() }), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return res.status(200).json({ ok: true, id: d.id });
      }

      const id = `${new Date().toISOString().slice(5, 10).replace('-', '')}-${randomBytes(3).toString('hex')}`;
      const doc = { id, text: request, by: user.email, branch: `design/${id}`, attempt: 1, state: 'working', history: [], createdAt: FieldValue.serverTimestamp() };
      await dispatch(doc, 1, request, false);
      await col.doc(id).set(doc);
      return res.status(200).json({ ok: true, id });
    }

    if (body.action === 'list') {
      const snap = await col.orderBy('createdAt', 'desc').limit(15).get();
      const items = await Promise.all(snap.docs.map(async (s) => {
        try { return await refresh(s.ref, s.data()); } catch (err) { return { ...s.data(), reason: s.data().reason || err.message }; }
      }));
      return res.status(200).json({ items: items.map(publicView) });
    }

    if (body.action === 'approve' || body.action === 'discard') {
      const ref = col.doc(String(body.id || ''));
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Request not found.' });
      const d = await refresh(ref, snap.data());

      if (body.action === 'approve') {
        if (d.state !== 'ready' || !d.prNumber) return res.status(409).json({ error: 'This change isn’t ready to publish yet.' });
        try {
          await gh(`/repos/${REPO}/pulls/${d.prNumber}/merge`, { method: 'PUT', body: { merge_method: 'squash', commit_title: `Design: ${d.text.slice(0, 70)} (#${d.prNumber})` } });
        } catch (err) {
          if (err.status === 405 || err.status === 409) return res.status(409).json({ error: 'The site changed since this was made, so it can’t be merged automatically. Use “Request changes” and ask Claude to redo it.' });
          throw err;
        }
        await gh(`/repos/${REPO}/git/refs/heads/${d.branch}`, { method: 'DELETE' }).catch(() => {});
        await ref.set({ state: 'published', approvedBy: user.email, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return res.status(200).json({ ok: true });
      }

      if (d.prNumber) await gh(`/repos/${REPO}/pulls/${d.prNumber}`, { method: 'PATCH', body: { state: 'closed' } }).catch(() => {});
      await gh(`/repos/${REPO}/git/refs/heads/${d.branch}`, { method: 'DELETE' }).catch(() => {});
      await ref.set({ state: 'discarded', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('design failed', err);
    if (err.status === 401 || err.status === 403) return res.status(500).json({ error: 'The GitHub token in Vercel is missing a permission or has expired.' });
    if (err.status === 404) return res.status(500).json({ error: 'GitHub couldn’t find the repo or the Design change workflow. Is it merged into main?' });
    return res.status(500).json({ error: 'Something went wrong talking to GitHub. Please try again.' });
  }
}

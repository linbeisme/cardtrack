const API_VERSION = '2026-03-10';

function encodeUtf8Base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function githubRequest(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': API_VERSION,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }
  if (!response.ok) {
    const error = new Error(body?.message || `GitHub request failed with status ${response.status}.`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export function inferGitHubLocation(location = window.location) {
  const host = location.hostname.toLowerCase();
  const path = location.pathname.split('/').filter(Boolean);
  if (host.endsWith('.github.io')) {
    return {
      owner: host.split('.')[0],
      repo: path[0] || `${host.split('.')[0]}.github.io`,
      branch: 'main',
      filePath: 'site/data/cardtrack.json'
    };
  }
  return { owner: '', repo: 'cardtrack', branch: 'main', filePath: 'site/data/cardtrack.json' };
}

export async function testRepositoryAccess(config, token) {
  const { owner, repo } = config;
  return githubRequest(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
}

export async function publishDatabase(config, token, database, commitMessage) {
  const { owner, repo, branch, filePath } = config;
  if (!owner || !repo || !branch || !filePath) throw new Error('GitHub owner, repository, branch, and file path are required.');
  if (!token) throw new Error('Paste your fine-grained GitHub token.');
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
  const current = await githubRequest(`${endpoint}?ref=${encodeURIComponent(branch)}`, token);
  const serialized = `${JSON.stringify(database, null, 2)}\n`;
  const result = await githubRequest(endpoint, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: encodeUtf8Base64(serialized),
      sha: current.sha,
      branch
    })
  });
  return result;
}

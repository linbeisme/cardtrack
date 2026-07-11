const API_VERSION = "2022-11-28";

function encodeUtf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function headers(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
    "Content-Type": "application/json"
  };
}

function apiUrl(owner, repo, path, branch) {
  const cleanPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}?ref=${encodeURIComponent(branch)}`;
}

export async function getRepositoryFile({owner, repo, branch = "main", path, token}) {
  const response = await fetch(apiUrl(owner, repo, path, branch), {headers: headers(token)});
  if (!response.ok) throw new Error(`GitHub read failed (${response.status}): ${await response.text()}`);
  return response.json();
}

export async function testRepositoryAccess({owner, repo, branch = "main", path, token}) {
  const file = await getRepositoryFile({owner, repo, branch, path, token});
  return {ok: true, sha: file.sha, htmlUrl: file.html_url};
}

export async function putJsonFile({owner, repo, branch = "main", path, token, value, message}) {
  const current = await getRepositoryFile({owner, repo, branch, path, token});
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const url = apiUrl(owner, repo, path, branch).replace(/\?ref=.*$/, "");
  const response = await fetch(url, {
    method: "PUT",
    headers: headers(token),
    body: JSON.stringify({message, content: encodeUtf8Base64(content), sha: current.sha, branch})
  });
  if (!response.ok) throw new Error(`GitHub save failed (${response.status}): ${await response.text()}`);
  return response.json();
}

export function inferRepoFromLocation(location = window.location) {
  const hostMatch = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (!hostMatch) return {owner: "", repo: "", branch: "main"};
  const firstSegment = location.pathname.split("/").filter(Boolean)[0] || "";
  return {owner: hostMatch[1], repo: firstSegment, branch: "main"};
}

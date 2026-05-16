// api/backup.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { ghToken, username, repo } = req.body || req.query;

  // ====================== DOWNLOAD ZIP ROUTE ======================
  if (req.method === 'GET' && req.url.includes('/api/download')) {
    if (!repo || !ghToken) {
      return res.status(400).json({ error: "Missing repo or token" });
    }

    try {
      const [owner, name] = repo.split('/');
      const zipUrl = `https://api.github.com/repos/${owner}/${name}/zipball/main`;

      const response = await fetch(zipUrl, {
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Lazarus-Backup'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to download repo" });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`);
      
      return response.body.pipe(res);

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ====================== BACKUP INFO ROUTE ======================
  if (req.method === 'POST') {
    try {
      if (!ghToken || !username) {
        return res.status(400).json({ error: "ghToken and username are required" });
      }

      // Get all repositories (public + private)
      const reposRes = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated`, {
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!reposRes.ok) {
        return res.status(401).json({ error: "Invalid token or insufficient permissions" });
      }

      const repos = await reposRes.json();

      const results = repos.map(repo => ({
        repo: repo.full_name,
        private: repo.private,
        status: "ready",
        default_branch: repo.default_branch
      }));

      res.status(200).json({
        success: true,
        total: repos.length,
        username: username,
        results: results
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

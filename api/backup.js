// api/backup.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const ghToken = req.query.ghToken || req.body?.ghToken;
  const repo = req.query.repo || req.body?.repo;

  // ===================== DOWNLOAD ENDPOINT =====================
  if (req.method === 'GET' && repo) {
    try {
      const [owner, name] = repo.split('/');
      if (!owner || !name) return res.status(400).json({ error: "Invalid repo format" });

      const zipUrl = `https://api.github.com/repos/${owner}/${name}/zipball/main`;

      const response = await fetch(zipUrl, {
        headers: {
          'Authorization': `token ${ghToken}`,
          'User-Agent': 'Lazarus-Backup'
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: `GitHub Error: ${response.status}` 
        });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`);

      return response.body.pipe(res);

    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to proxy download" });
    }
  }

  // ===================== LIST REPOSITORIES =====================
  if (req.method === 'POST') {
    try {
      const { username } = req.body;
      if (!ghToken || !username) {
        return res.status(400).json({ error: "Token and username required" });
      }

      const reposRes = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated`, {
        headers: { 'Authorization': `token ${ghToken}` }
      });

      if (!reposRes.ok) {
        return res.status(401).json({ error: "Invalid token or no permission" });
      }

      const repos = await reposRes.json();

      res.json({
        success: true,
        total: repos.length,
        results: repos.map(r => ({
          repo: r.full_name,
          name: r.name,
          private: r.private
        }))
      });

    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

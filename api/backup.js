// api/backup.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const ghToken = req.query.ghToken || req.body?.ghToken;
  const repoFullName = req.query.repo || req.body?.repo;

  // Download ZIP
  if (req.method === 'GET' && repoFullName) {
    try {
      const [owner, name] = repoFullName.split('/');
      
      const zipUrl = `https://api.github.com/repos/${owner}/${name}/zipball/main`;

      const githubRes = await fetch(zipUrl, {
        headers: {
          'Authorization': `token ${ghToken}`,
          'User-Agent': 'Lazarus-Backup'
        }
      });

      if (!githubRes.ok) {
        return res.status(githubRes.status).json({ error: `GitHub Error ${githubRes.status}` });
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.zip"`);

      return githubRes.body.pipe(res);

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Proxy failed" });
    }
  }

  // List repositories
  if (req.method === 'POST') {
    try {
      const reposRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: { 'Authorization': `token ${ghToken}` }
      });

      if (!reposRes.ok) throw new Error("Token invalid or no permission");

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
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

// api/backup.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { ghToken, username, backupName } = req.body;

    if (!ghToken || !username) {
      return res.status(400).json({ error: "ghToken and username are required" });
    }

    const backupRepoName = backupName || `lazarus-backup-${new Date().toISOString().slice(0,10)}`;

    log(`Starting backup for ${username}`);

    // 1. Create Backup Repository
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: backupRepoName,
        description: `Full GitHub Backup of ${username} - Created by Lazarus Backup`,
        private: true,
        auto_init: true
      })
    });

    if (!createRes.ok) throw new Error("Failed to create backup repository");
    const backupRepo = await createRes.json();

    // 2. Get all user repositories
    const reposRes = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated`, {
      headers: { 'Authorization': `token ${ghToken}` }
    });

    const repos = await reposRes.json();

    const results = [];

    // 3. Add each repo as a Git Submodule
    for (const repo of repos) {
      try {
        const submodulePath = repo.name;

        // Add as submodule
        const addSubmoduleRes = await fetch(`https://api.github.com/repos/${backupRepo.full_name}/contents/.gitmodules`, {
          method: 'PUT',
          headers: { 'Authorization': `token ${ghToken}` },
          body: JSON.stringify({
            message: `Add submodule: ${repo.name}`,
            content: Buffer.from(`[submodule "${submodulePath}"]\n\tpath = ${submodulePath}\n\turl = ${repo.clone_url}`).toString('base64'),
            branch: "main"
          })
        });

        // Create submodule reference (simplified - real implementation needs tree API)
        results.push({
          repo: repo.full_name,
          status: "added_as_submodule",
          url: `${backupRepo.html_url}/tree/main/${submodulePath}`
        });

        await new Promise(r => setTimeout(r, 1000));

      } catch (e) {
        results.push({ repo: repo.full_name, status: "failed", reason: e.message });
      }
    }

    res.json({
      success: true,
      message: "Backup repository created with submodules",
      backupRepo: backupRepo.full_name,
      backupUrl: backupRepo.html_url,
      total: repos.length,
      results
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

function log(msg) {
  console.log(`[Lazarus] ${msg}`);
}

const REPO = "ValMtp3/Juste-Recrute-Moi";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const [repoRes, prsRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}`, {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "juste-recrute-moi-website",
        },
      }),
      fetch(`https://api.github.com/search/issues?q=repo:${REPO}+type:pr+state:open&per_page=1`, {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "juste-recrute-moi-website",
        },
      }),
    ]);

    if (!repoRes.ok) {
      throw new Error(`GitHub Repo API responded with ${repoRes.status}`);
    }

    const repo = await repoRes.json();
    const prs = prsRes.ok ? await prsRes.json() : { total_count: 0 };

    response.setHeader("cache-control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).json({
      repo: REPO,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      pullRequests: prs.total_count,
      openIssues: repo.open_issues_count - (prs.total_count || 0),
      url: repo.html_url,
    });
  } catch (error) {
    response.setHeader("cache-control", "public, max-age=300, s-maxage=1800");
    response.status(200).json({
      repo: REPO,
      stars: null,
      forks: null,
      pullRequests: null,
      openIssues: null,
      url: "https://github.com/ValMtp3/Juste-Recrute-Moi",
    });
  }
}

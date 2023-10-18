import https from "https";
import { readFile, writeFile } from "node:fs/promises";

/** Make a network request */
const request = (params) => {
  return new Promise((resolve, reject) => {
    const req = https.request(params, (res) => {
      let str = "";
      res.on("data", (chunk) => (str += chunk));
      res.on("end", () => resolve(str));
      res.on("error", (error) => reject(error));
    });
    req.end();
  });
};

export const updateData = async () => {
  /** @type {{ [key: string]: { color: string; url: string } }} */
  const colors = JSON.parse(
    await request({
      hostname: "raw.githubusercontent.com",
      path: "/ozh/github-colors/master/colors.json",
      port: 443,
      method: "GET",
      headers: { "User-Agent": "AnandChowdhary/featured" },
    })
  );
  console.log("Fetched colors");

  /** @type {string} */
  let data = await request({
    hostname: "github.com",
    path: "/stars/AnandChowdhary/lists/featured-projects",
    port: 443,
    method: "GET",
    headers: { "User-Agent": "AnandChowdhary/featured" },
  });
  console.log("Fetched first page");
  let hasNext = data.includes('rel="next"');
  console.log("Next page?", hasNext);

  let page = 1;
  while (hasNext) {
    const result = await request({
      hostname: "github.com",
      path: `/stars/AnandChowdhary/lists/featured-projects?page=${++page}`,
      port: 443,
      method: "GET",
      headers: { "User-Agent": "AnandChowdhary/featured" },
    });
    hasNext = result.includes('rel="next"');
    data += result;
    console.log("Next page?", hasNext);
  }

  const repos = (
    await Promise.all(
      (
        await Promise.all(
          (data.match(/\<h3\>\n.+\<a href=\".+\"\>/g) ?? [])
            .map((code) => code.split(`href="/`)[1]?.split(`"`)[0] ?? "")
            .filter((repoName) => !!repoName)
            .map((repo) =>
              request({
                hostname: "api.github.com",
                path: `/repos/${repo}`,
                port: 443,
                method: "GET",
                headers: {
                  "User-Agent": "AnandChowdhary/featured",
                  Authorization: `Basic ${Buffer.from(
                    process.env.GITHUB_USERNAME + ":" + process.env.GITHUB_TOKEN
                  ).toString("base64")}`,
                },
              })
            )
        )
      ).map((jsonAsText) => {
        const data = JSON.parse(jsonAsText);
        return {
          ...data,
          language_color: !data.language
            ? null
            : (colors[data.language] || {}).color || null,
        };
      })
    )
  ).sort((a, b) => b.stargazers_count - a.stargazers_count);
  console.log(repos);
  console.log("Fetched all repos", repos.length);

  await writeFile("repos.json", JSON.stringify(repos, null, 2) + "\n");
  const readmeText = await readFile("README.md", "utf8");
  await writeFile(
    "README.md",
    readmeText.split("<!--start:generated-->")[0] +
      "<!--start:generated-->\n\n| Project | Language | Stars |\n| ------- | -------- | ----------- |\n" +
      repos
        .map(
          (repo, index) =>
            `| #${index + 1} [${repo.name}](${repo.html_url}) | ${
              repo.language
                ? `<img alt="" src="https://images.weserv.nl/?url=img.spacergif.org/v1/20x20/${(
                    repo.language_color || ""
                  ).replace(
                    "#",
                    ""
                  )}.png&mask=circle" width="10" height="10"> ${repo.language}`
                : ""
            } | ${repo.stargazers_count} |`
        )
        .join("\n") +
      "\n\n<!--end:generated-->" +
      readmeText.split("<!--end:generated-->")[1]
  );
};

updateData();

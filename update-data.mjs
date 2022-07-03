import { writeFileSync } from "node:fs";
import https from "https";

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
  const data = await request({
    hostname: "github.com",
    path: "/stars/AnandChowdhary/lists/featured-projects",
    port: 443,
    method: "GET",
    headers: { "User-Agent": "AnandChowdhary/featured" },
  });
  const repos = await Promise.all(
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
    ).map((jsonAsText) => JSON.parse(jsonAsText))
  );
  writeFileSync("repos.json", JSON.stringify(repos, null, 2) + "\n");
};

updateData();

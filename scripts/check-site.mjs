import { access, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredOutputs = [
  "_site/index.html",
  "_site/about.html",
  "_site/topics.html",
  "_site/updates.html",
  "_site/assets/github-profile.jpg",
  "_site/assets/social-card.png",
];

const failures = [];

for (const relativePath of requiredOutputs) {
  try {
    await access(join(root, relativePath));
  } catch {
    failures.push(`missing rendered file: ${relativePath}`);
  }
}

const postsRoot = join(root, "posts");
let articleCount = 0;
for (const entry of await readdir(postsRoot, { withFileTypes: true })) {
  if (entry.name.startsWith(".")) continue;
  if (!entry.isDirectory()) {
    failures.push(`posts/ may contain article directories only: posts/${entry.name}`);
    continue;
  }
  articleCount += 1;
  const articleRoot = join(postsRoot, entry.name);
  for (const required of ["index.qmd", "assets"]) {
    try {
      const info = await stat(join(articleRoot, required));
      if (required === "assets" && !info.isDirectory()) {
        failures.push(`article assets path is not a directory: posts/${entry.name}/assets`);
      }
    } catch {
      failures.push(`article is missing ${required}: posts/${entry.name}`);
    }
  }
}

try {
  const indexHtml = await readFile(join(root, "_site/index.html"), "utf8");
  for (const marker of ["Здесь водятся", "драконы", "quarto-color-scheme-toggle", 'data-mode="light"', 'data-mode="dark"']) {
    if (!indexHtml.includes(marker)) failures.push(`rendered landing is missing marker: ${marker}`);
  }
  if (!indexHtml.includes('rel="icon"') || !indexHtml.includes('href="./assets/github-profile.jpg"')) {
    failures.push("rendered landing must use the GitHub profile image as favicon");
  }
  if (indexHtml.includes("quarto-listing")) failures.push("landing must not contain a post listing while the site is empty");
} catch {
  // The missing output is already reported above.
}

try {
  const aboutHtml = await readFile(join(root, "_site/about.html"), "utf8");
  for (const marker of ["assets/github-profile.jpg", "https://github.com/zuzuka28", "https://github.com/zuzuka28/public-blog"]) {
    if (!aboutHtml.includes(marker)) failures.push(`rendered About is missing GitHub marker: ${marker}`);
  }
} catch {
  // The missing output is already reported above.
}

if (failures.length) {
  console.error("Site checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Site checks passed: ${requiredOutputs.length} outputs and ${articleCount} article directories are valid.`);

import { access, readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredOutputs = [
  "_site/index.html",
  "_site/about.html",
  "_site/updates.html",
  "_site/updates.xml",
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

try {
  await access(join(root, "_site/topics.html"));
  failures.push("removed Topics route must not be rendered");
} catch (error) {
  if (error.code !== "ENOENT") failures.push("unable to verify removal of _site/topics.html");
}

const postsRoot = join(root, "posts");
let articleCount = 0;
const articleSlugs = [];
for (const entry of await readdir(postsRoot, { withFileTypes: true })) {
  if (entry.name.startsWith(".")) continue;
  if (!entry.isDirectory()) {
    failures.push(`posts/ may contain article directories only: posts/${entry.name}`);
    continue;
  }
  articleCount += 1;
  articleSlugs.push(entry.name);
  const articleRoot = join(postsRoot, entry.name);
  try {
    await access(join(articleRoot, "index.qmd"));
  } catch {
    failures.push(`article is missing index.qmd: posts/${entry.name}`);
  }
  try {
    const assets = await stat(join(articleRoot, "assets"));
    if (!assets.isDirectory()) failures.push(`article assets path is not a directory: posts/${entry.name}/assets`);
  } catch (error) {
    if (error.code !== "ENOENT") failures.push(`unable to inspect article assets: posts/${entry.name}/assets`);
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
  for (const marker of [
    'data-goatcounter="https://zuzuka28.goatcounter.com/count"',
    'src="https://gc.zgo.at/count.js"',
    "data-goatcounter-counter-ui",
    "https://zuzuka28.goatcounter.com/counter/",
  ]) {
    if (!indexHtml.includes(marker)) failures.push(`rendered landing is missing GoatCounter marker: ${marker}`);
  }
  if (indexHtml.includes('class="quarto-listing')) failures.push("landing must not contain a post listing");
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

try {
  const updatesSource = await readFile(join(root, "updates.qmd"), "utf8");
  if (!updatesSource.includes("categories: true")) failures.push("Updates listing must enable native category filters");

  const updatesHtml = await readFile(join(root, "_site/updates.html"), "utf8");
  const articleMarkers = articleSlugs.map((slug) => `posts/${slug}/index.html`);
  for (const marker of ["quarto-listing", "quarto-listing-category-title", ...articleMarkers]) {
    if (!updatesHtml.includes(marker)) failures.push(`rendered Updates is missing marker: ${marker}`);
  }
} catch {
  // The missing output is already reported above.
}

if (failures.length) {
  console.error("Site checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Site checks passed: ${requiredOutputs.length} outputs and ${articleCount} article directories are valid.`);

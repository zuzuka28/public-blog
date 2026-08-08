import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const siteRoot = join(root, "_site");
const outputRoot = join(root, "previews");

const chromeCandidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

const shots = [
  { name: "landing-desktop.png", path: "/index.html", width: 1440, height: 1000 },
  { name: "landing-dark.png", path: "/index.html", width: 1440, height: 1000, dark: true },
  { name: "landing-mobile.png", path: "/index.html", width: 390, height: 844, mobile: true },
  { name: "updates-desktop.png", path: "/updates.html", width: 1440, height: 1000 },
  { name: "updates-dark.png", path: "/updates.html", width: 1440, height: 1000, dark: true },
  { name: "about-desktop.png", path: "/about.html", width: 1440, height: 1000 },
  { name: "about-dark.png", path: "/about.html", width: 1440, height: 1000, dark: true },
];

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue through known browser locations.
    }
  }
  throw new Error("Chrome/Chromium not found. Set CHROME_BIN to a Chrome-compatible executable.");
}

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function startStaticServer() {
  return new Promise((resolveServer) => {
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url, "http://127.0.0.1");
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith("/")) pathname += "index.html";
        const absolutePath = normalize(join(siteRoot, pathname));
        if (!absolutePath.startsWith(siteRoot)) {
          response.writeHead(403).end("Forbidden");
          return;
        }
        const content = await readFile(absolutePath);
        response.writeHead(200, {
          "Content-Type": mimeTypes[extname(absolutePath)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        });
        response.end(content);
      } catch {
        response.writeHead(404).end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

class DevTools {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolveCall, rejectCall } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) rejectCall(new Error(message.error.message));
      else resolveCall(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolveCall, rejectCall });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "browser evaluation failed");
    return response.result.value;
  }

  close() { this.socket.close(); }
}

async function waitFor(check, message, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await check()) return;
    await delay(120);
  }
  throw new Error(`Timed out: ${message}`);
}

async function openPage(cdpPort, url, shot) {
  const targetResponse = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Chrome target creation failed: ${targetResponse.status}`);
  const target = await targetResponse.json();
  const devtools = new DevTools(target.webSocketDebuggerUrl);
  await devtools.open();
  await devtools.send("Page.enable");
  await devtools.send("Runtime.enable");
  await devtools.send("Emulation.setDeviceMetricsOverride", {
    width: shot.width,
    height: shot.height,
    deviceScaleFactor: 1,
    mobile: Boolean(shot.mobile),
  });
  await devtools.send("Page.navigate", { url });
  return devtools;
}

async function capture(devtools, shot) {
  const waitForPage = () => waitFor(
    () => devtools.evaluate('document.readyState === "complete" && (!document.fonts || document.fonts.status === "loaded")'),
    `${shot.path} did not finish loading`,
  );
  await waitForPage();
  const isDark = await devtools.evaluate('document.body.classList.contains("quarto-dark")');
  if (Boolean(shot.dark) !== isDark) {
    await devtools.evaluate('window.quartoToggleColorScheme()');
    await waitFor(
      () => devtools.evaluate(`document.body.classList.contains("${shot.dark ? "quarto-dark" : "quarto-light"}")`),
      `${shot.path} did not switch to ${shot.dark ? "dark" : "light"} mode`,
    );
    await devtools.send("Page.reload", { ignoreCache: true });
    await waitForPage();
  }
  if (shot.waitForDeck) {
    await waitFor(
      () => devtools.evaluate('Boolean(document.querySelector(".scrolly-slides__frame")?.contentWindow?.Reveal?.isReady())'),
      `${shot.path} Reveal deck did not become ready`,
    );
  }
  await devtools.evaluate(`document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, ${shot.scrollY ?? 0});`);
  await delay(700);
  const { data } = await devtools.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(join(outputRoot, shot.name), Buffer.from(data, "base64"));
}

await access(siteRoot);
await mkdir(outputRoot, { recursive: true });
const chrome = await findChrome();
const cdpPort = await freePort();
const profile = await mkdtemp(join(tmpdir(), "public-blog-chrome-"));
const staticServer = await startStaticServer();
const address = staticServer.address();
const browser = spawn(chrome, [
  "--headless=new",
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "about:blank",
], { stdio: "ignore" });

try {
  await waitFor(async () => {
    try {
      return (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).ok;
    } catch {
      return false;
    }
  }, "Chrome DevTools did not start");

  for (const shot of shots) {
    const url = `http://127.0.0.1:${address.port}${shot.path}`;
    const devtools = await openPage(cdpPort, url, shot);
    try {
      await capture(devtools, shot);
      console.log(`Captured previews/${shot.name}`);
    } finally {
      devtools.close();
    }
  }
} finally {
  browser.kill("SIGTERM");
  await new Promise((resolveClose) => staticServer.close(resolveClose));
  await rm(profile, { recursive: true, force: true });
}

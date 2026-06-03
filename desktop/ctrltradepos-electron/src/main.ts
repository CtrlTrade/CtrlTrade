import { app, BrowserWindow, Menu } from "electron";
import * as path from "path";
import * as http from "http";
import * as fs from "fs";
import type { AddressInfo } from "net";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8",
};

// Serve the exported Expo web build over http://127.0.0.1 instead of loading it
// directly from disk with file://. Under file:// the bundle's absolute asset
// paths (/_expo/static/...) resolve to the filesystem root and Expo Router's
// History-based routing has an opaque origin, so the app renders a blank page.
// A real localhost origin fixes both, with an SPA fallback to index.html.
function startStaticServer(rootDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const indexPath = path.join(rootDir, "index.html");

    const server = http.createServer((req, res) => {
      try {
        const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);
        const resolved = path.normalize(path.join(rootDir, rawPath));

        // Prevent path traversal outside the served directory.
        if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
          res.writeHead(403);
          res.end("Forbidden");
          return;
        }

        const isFile = fs.existsSync(resolved) && fs.statSync(resolved).isFile();
        const filePath = isFile ? resolved : indexPath;
        const ext = path.extname(filePath).toLowerCase();

        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Cache-Control": "no-cache",
        });
        fs.createReadStream(filePath).pipe(res);
      } catch {
        res.writeHead(500);
        res.end("Internal Server Error");
      }
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "CtrlTradePos",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    backgroundColor: "#010C1E",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.maximize();

  const wwwDir = path.join(__dirname, "..", "www");
  const baseUrl = await startStaticServer(wwwDir);
  await win.loadURL(baseUrl);

  return win;
}

function setupMenu(): void {
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  } else {
    const devMenu = Menu.buildFromTemplate([
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
    ]);
    Menu.setApplicationMenu(devMenu);
  }
}

app.whenReady().then(() => {
  setupMenu();
  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

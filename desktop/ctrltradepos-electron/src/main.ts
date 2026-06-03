import { app, BrowserWindow, Menu } from "electron";
import * as path from "path";

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "CtrlTradePos",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.maximize();

  const indexPath = path.join(__dirname, "..", "www", "index.html");
  win.loadFile(indexPath);

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
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

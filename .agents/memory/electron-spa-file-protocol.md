---
name: Electron loading an Expo/SPA web build
description: Why a packaged Electron app shows a blank screen when loading an Expo Router "single" build, and the fix
---

# Electron + Expo Router (output: "single") blank screen

**Symptom:** Packaged Electron desktop app renders a blank screen (color depends on what is behind it — the window `backgroundColor` shows dark, the empty HTML body shows white). React mounts but nothing visible renders.

**Root cause:** Loading the exported web build with `win.loadFile(.../www/index.html)` uses the `file://` protocol. Two things break under `file://`:
1. Expo's `output: "single"` `index.html` references assets with **absolute paths** (`/_expo/static/...`), which resolve to the filesystem root, not the app dir.
2. Expo Router uses the History API; `file://` has an **opaque origin**, so route resolution fails and no screen renders.

**Fix:** Serve the `www` folder over `http://127.0.0.1:<ephemeral>` from inside the Electron main process (minimal Node `http` static server, dependency-free) with an **SPA fallback to index.html**, then `win.loadURL(...)`. A real HTTP origin fixes both asset paths and routing.

**Why this over alternatives:** No reliable built-in Expo flag makes "single" output emit relative asset paths; a localhost server (or a custom privileged `app://` protocol) is the standard, robust solution.

**How to apply:** Bind to `127.0.0.1` + `listen(0)` (local-only, ephemeral port), guard against path traversal (normalize under rootDir, 403 otherwise), reuse a single server instance across window re-creations and close it on `before-quit`.

**Misleading clue:** Changing splash/loading logic can flip the blank color (dark→white) without fixing anything — the loading `<View>` was just masking the empty render. Don't mistake the color change for progress; the real issue is the load protocol.

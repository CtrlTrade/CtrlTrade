# CtrlTradePos Desktop App

Electron wrapper for CtrlTradePos that bundles the Expo web export into a standalone Windows (.exe) or macOS (.dmg) installer.

No internet connection is required at runtime — the web app is fully bundled inside the Electron package.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 or later |
| pnpm | 9 or later |
| Expo CLI | bundled via `@expo/cli` in the ctrltradepos package |

**App icon files** are pre-built and committed in `assets/`:

| File | Purpose |
|---|---|
| `assets/icon.png` | 1024×1024 source PNG — used by Linux and as the runtime window icon |
| `assets/icon.ico` | Windows installer / taskbar icon (PNG-in-ICO, 1024×1024) |
| `assets/icon.icns` | macOS dock / DMG icon (ICNS container with PNG, `ic10` 1024×1024) |

electron-builder automatically picks the correct format per platform via the `"icon": "assets/icon"` entry in `package.json`.

**Platform notes:**
- `.exe` NSIS installer can only be built on **Windows**.
- `.dmg` disk image can only be built on **macOS**.
- Cross-platform building (e.g. building a Windows installer on macOS) is not supported without additional tooling.

---

## Step-by-step build instructions

### 1. Install dependencies

From the workspace root:

```bash
pnpm install
```

### 2. Set the API server URL

The desktop app needs to know where your backend API lives. The URL is baked into the static web bundle at build time.

Copy the example file and fill in your value:

```bash
cp desktop/ctrltradepos-electron/.env.example desktop/ctrltradepos-electron/.env
```

Then open `desktop/ctrltradepos-electron/.env` and set:

```dotenv
EXPO_PUBLIC_DOMAIN=https://your-production-api-domain.com
```

**Rules:**
- No trailing slash.
- Must be an `https://` URL in production.
- `.env` is git-ignored — never commit it.
- To target a different environment (staging, local) just change this value and re-run `build:web`. No other rebuild is needed.
- You can also skip the file entirely and export the variable in your shell before running the build step (`export EXPO_PUBLIC_DOMAIN=https://...`); a shell-level value takes precedence over `.env`.

> **If this is left empty** all API calls from the desktop app will silently fail because Electron loads the bundle from disk (no domain), and the app cannot infer the server address at runtime.

### 3. Export the Expo web build

This compiles the React Native / Expo app to a static web bundle and places it in `www/`:

```bash
pnpm --filter @workspace/ctrltradepos-electron run build:web
```

> The export runs `expo export --platform web` inside the `ctrltradepos` package. It may take a few minutes on the first run.

### 3a. Build the Windows installer (run on Windows)

```bash
pnpm --filter @workspace/ctrltradepos-electron run dist:win
```

Output: `desktop/ctrltradepos-electron/dist/CtrlTradePos Setup <version>.exe`

### 3b. Build the macOS disk image (run on macOS)

```bash
pnpm --filter @workspace/ctrltradepos-electron run dist:mac
```

Output: `desktop/ctrltradepos-electron/dist/CtrlTradePos-<version>.dmg`

---

## Development mode

To open the app locally without building an installer (useful for testing):

```bash
pnpm --filter @workspace/ctrltradepos-electron run build:web   # only needed once
pnpm --filter @workspace/ctrltradepos-electron run start
```

This compiles `src/main.ts` → `src/main.js` and launches Electron with a minimal dev menu (reload, DevTools, fullscreen).

---

## Releasing via GitHub Actions

Push a version tag and GitHub automatically builds both the Windows `.exe` and the macOS `.dmg`, then attaches them to a GitHub Release — no local Windows or macOS machine needed.

### One-time setup

1. **Push the repo to GitHub** (if not already done).
2. **Add the `EXPO_PUBLIC_DOMAIN` secret** in your GitHub repository:
   - Go to **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `EXPO_PUBLIC_DOMAIN`
   - Value: your production domain, e.g. `ctrltrade.co.uk` (no `https://`, no trailing slash)

### Releasing a new version

```bash
# Tag the commit you want to release
git tag v1.0.0
git push origin v1.0.0
```

That's it. GitHub Actions picks up the tag and runs two parallel jobs:

| Job | Runner | Output |
|---|---|---|
| `build-windows` | `windows-latest` | `CtrlTradePos Setup <version>.exe` |
| `build-macos` | `macos-latest` | `CtrlTradePos-<version>.dmg` |

Both artefacts are uploaded to the GitHub Release automatically (usually takes ~10–15 minutes).

You can then download the installers from the **Releases** page of your GitHub repo and upload them via **Admin → POS Downloads** to update the footer download links on the site.

---

## Code signing & notarisation

### Windows — stop the SmartScreen "unknown publisher" warning

By default Windows Defender SmartScreen warns users that the installer is from an
"unknown publisher" because the `.exe` is **not code-signed**. Signing it with a
certificate makes Windows recognise CtrlTrade as the publisher and removes the
warning (immediately with an EV certificate; gradually as reputation builds with an
OV certificate).

The build is already **wired for signing**: it signs automatically when the right
credentials are present in the environment and produces an unsigned build otherwise,
so nothing breaks before you buy a certificate. Build config lives in
`electron-builder.config.js`.

Pick **one** of the two options below and add the values as **GitHub repository
secrets** (Settings → Secrets and variables → Actions). The `build-desktop.yml`
workflow already passes them through.

**Option A — PFX / .p12 certificate file** (an OV or EV cert exported to a file):

| Secret | Value |
|---|---|
| `WINDOWS_CSC_LINK` | Base64 of the `.pfx`/`.p12` file (`base64 -w0 cert.pfx`) — or a URL to it |
| `WINDOWS_CSC_KEY_PASSWORD` | The certificate's password |

> Note: an **EV** certificate normally lives on a hardware token / HSM and cannot be
> exported to a file, so Option A is mainly for **OV** certificates. For an EV cert in
> CI, use Option B.

**Option B — Azure Trusted Signing** (cloud signing, no hardware token, runs in CI —
the low-cost recommended option):

| Secret | Value |
|---|---|
| `AZURE_CODE_SIGNING_ENDPOINT` | e.g. `https://eus.codesigning.azure.net/` |
| `AZURE_CODE_SIGNING_ACCOUNT` | Trusted Signing account name |
| `AZURE_CERTIFICATE_PROFILE` | Certificate profile name |
| `AZURE_TENANT_ID` / `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` | Service principal credentials for the signing tool |
| `WINDOWS_PUBLISHER_NAME` | _(optional)_ display name, defaults to `CtrlTrade` |

Once secrets are added, the next tag push (`git tag vX.Y.Z && git push origin vX.Y.Z`)
produces a signed installer. Verify it by right-clicking the `.exe` →
**Properties → Digital Signatures** — it should list CtrlTrade as a valid signer.

To sign locally instead of in CI, export the same variables in your shell before
running `pnpm run dist:win`.

### macOS

Enrol in the Apple Developer Programme, set up a Developer ID Application certificate,
and add your Apple ID credentials for notarisation. See the
[electron-builder macOS docs](https://www.electron.build/configuration/mac).

---

## Project structure

```
desktop/ctrltradepos-electron/
├── assets/
│   ├── icon.png         # 1024×1024 source icon (Linux / runtime window icon)
│   ├── icon.ico         # Windows installer / taskbar icon (PNG-in-ICO)
│   └── icon.icns        # macOS dock / DMG icon (ICNS with PNG ic10)
├── src/
│   └── main.ts          # Electron main process (compiled to src/main.js)
├── www/                 # Generated by build:web — not committed
├── dist/                # Generated by dist:win / dist:mac — not committed
├── package.json
├── tsconfig.json
└── README.md
```

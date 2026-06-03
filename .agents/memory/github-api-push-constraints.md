---
name: GitHub API push constraints (CtrlTrade repo)
description: Pushing to CtrlTrade/CtrlTrade via the integration token — which APIs work, scope limits, and how the desktop installer version is derived.
---

# Pushing to CtrlTrade/CtrlTrade via the GitHub integration token

## The rules
- Push file changes with the **Contents API** (`PUT /repos/.../contents/{path}` with the file's current `sha`), one file per call. The low-level **git trees API returns 404** with this token — do not use it.
- The integration token has `repo` scope but **NOT `workflow` scope**. Any write under `.github/workflows/` returns **404**. You cannot modify CI workflow files via the API; the user must edit them in GitHub directly or re-authorize with `workflow` scope.
- Tag a release by creating a ref: `POST /git/refs` with `ref: "refs/tags/vX.Y.Z"`. Pushing a `v*.*.*` tag triggers `.github/workflows/build-desktop.yml`.

## Desktop installer version
**The Windows installer filename comes from `desktop/ctrltradepos-electron/package.json` `version`, NOT the git tag.** electron-builder never reads the tag. To ship `CtrlTradePos-Setup-X.Y.Z.exe`, bump `version` in that package.json before tagging. (A CI step to auto-sync version from the tag exists locally but can't be pushed without `workflow` scope.)

**Why:** A tag of `v1.0.7` still produced `...Setup.0.0.0.exe` because package.json was stuck at `0.0.0`. Bumping the static field is the reliable lever.

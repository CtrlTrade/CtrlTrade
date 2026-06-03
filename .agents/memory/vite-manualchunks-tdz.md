---
name: Vite manualChunks TDZ crash
description: Hand-rolled manualChunks splitting interdependent vendor libs causes "Cannot access X before initialization" — blank prod page, dev fine
---

# Vite manualChunks → TDZ / circular-init crash

A custom `build.rollupOptions.output.manualChunks` that splits interdependent
node_modules into separate vendor chunks (e.g. `vendor-react`, `vendor-radix`,
and a catch-all `vendor`) can break a circular dependency's module-evaluation
order across chunk boundaries. Symptom in the deployed bundle:

```
ReferenceError: Cannot access 'te' before initialization
    at /assets/vendor-XXXX.js
```

The error throws during eager module eval, so React never mounts → **blank
page in production only**. Dev works because vite dev does not bundle/split.

**Why:** inter-chunk cycles let one chunk read a `const`/`let` from another
chunk before that chunk finished initializing (temporal dead zone). Hard to
diagnose: every chunk still returns HTTP 200, there is no top-level `throw` in
the source, and no 404s — only a real browser console reveals the ReferenceError.

**How to apply:** prefer removing the custom `manualChunks` and let Vite's
default chunking handle vendor splitting (it keeps cyclic modules together).
Dynamic-import code-splitting (lazy routes) still works without manualChunks.
If you must split vendors manually, never separate circularly-dependent
packages (react/react-dom and the libs that import them) into different chunks.

**How to capture the real error in this repo (no Playwright):** build the prod
bundle locally (`BASE_PATH=/ PORT=<devport> pnpm --filter @workspace/ctrltrade
exec vite build`), temporarily point the `dev` npm script at
`vite preview`, `restart_workflow` the web workflow, then use the `screenshot`
app_preview tool — it returns the browser console. Revert the script after.

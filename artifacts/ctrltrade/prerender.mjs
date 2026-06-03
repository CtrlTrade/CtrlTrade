/**
 * Build-time prerender script.
 *
 * Runs after `vite build` to generate static HTML files for every public
 * marketing route. Each file lands at dist/public/<route>/index.html so the
 * static server can serve it without a catch-all rewrite, giving crawlers real
 * HTML and enabling true HTTP 404s for unknown paths.
 *
 * Usage (called automatically by the `build` npm script):
 *   node prerender.mjs
 */

import { execSync }                                 from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync }   from "node:fs";
import { resolve, dirname }                          from "node:path";
import { fileURLToPath }                             from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Routes to prerender ──────────────────────────────────────────────────────

const routes = [
  "/",
  "/features",
  "/pricing",
  "/industries",
  "/integrations",
  "/addons",
  "/security",
  "/contact",
  "/crm",
  "/ctrltradepos",
  "/customer-portal",
  "/about",
  "/blog",
  "/status",
  "/marketplace",
  "/roofing-crm",
  "/electrical-crm",
  "/plumbing-crm",
  "/hvac-crm",
  "/builders-crm",
  "/cleaning-crm",
  "/facilities-management-crm",
  "/trade-counter-epos",
  "/warehouse-management-software",
  "/showroom-management-software",
  "/field-service-management-software",
  "/builders-merchants-crm",
  "/masonry-crm",
  "/timber-merchants-crm",
  "/heating-gas-crm",
  "/renewable-energy-crm",
  "/security-fire-crm",
  "/windows-doors-crm",
  "/kitchens-crm",
  "/bathrooms-crm",
  "/flooring-crm",
  "/tiles-crm",
  "/decorating-crm",
  "/landscaping-crm",
  "/fencing-crm",
  "/steel-metal-crm",
  "/industrial-supplies-crm",
  "/tools-equipment-crm",
  "/plant-machinery-crm",
  "/workwear-ppe-crm",
  "/automotive-crm",
  "/warehousing-crm",
  "/distribution-crm",
  "/manufacturing-crm",
  "/cabins-modular-crm",
  "/agricultural-crm",
  "/showrooms-crm",
  "/specialist-trades-crm",
  "/logistics-crm",
];

// ─── 1. Build the SSR bundle ──────────────────────────────────────────────────

console.log("⚙  Building SSR bundle…");
execSync(
  "vite build --ssr src/entry-server.tsx --outDir dist/server --config vite.config.ts",
  {
    stdio: "inherit",
    cwd: __dirname,
    env: { ...process.env, PORT: process.env.PORT ?? "23264", BASE_PATH: "/" },
  }
);
console.log("✓  SSR bundle ready\n");

// ─── 2. Load the built SSR entry and the client HTML template ─────────────────

const { render } = await import(
  resolve(__dirname, "dist/server/entry-server.js")
);

const templatePath = resolve(__dirname, "dist/public/index.html");
const template     = readFileSync(templatePath, "utf-8");

// Save the clean SPA shell (empty root) for use by the production rewrites.
// All authenticated/private routes (/app/*, /admin/*, /login, etc.) are
// rewritten to this file so they get a clean bootstrap — NOT the prerendered
// homepage HTML that lands in index.html after the loop below.
writeFileSync(resolve(__dirname, "dist/public/app-shell.html"), template, "utf-8");
console.log("✓  Saved app-shell.html (clean SPA bootstrap)\n");

// ─── 3. Render each route and write the output file ──────────────────────────

let ok = 0;
let failed = 0;

for (const route of routes) {
  try {
    const appHtml = render(route);
    const html = template.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`
    );

    const outDir =
      route === "/"
        ? resolve(__dirname, "dist/public")
        : resolve(__dirname, "dist/public", route.replace(/^\//, ""));

    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "index.html"), html, "utf-8");
    ok++;
    console.log(`  ✓  ${route}`);
  } catch (err) {
    failed++;
    console.error(`  ✗  ${route}  —  ${err?.message ?? err}`);
  }
}

console.log(
  `\nPrerender complete: ${ok} succeeded, ${failed} failed.\n`
);

if (failed > 0) {
  process.exit(1);
}

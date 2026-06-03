import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");

try {
  const contents = readFileSync(envPath, "utf8");
  const match = contents.match(/^EXPO_PUBLIC_DOMAIN\s*=\s*(.+)$/m);
  if (match) {
    process.env.EXPO_PUBLIC_DOMAIN = match[1].trim().replace(/^["']|["']$/g, "");
  }
} catch {
}

const domain = process.env.EXPO_PUBLIC_DOMAIN?.trim();

if (!domain) {
  console.error("");
  console.error("  ERROR: EXPO_PUBLIC_DOMAIN is not set.");
  console.error("");
  console.error("  The desktop build requires this variable so the app knows");
  console.error("  which API server to talk to. Without it every API call will");
  console.error("  fail at runtime.");
  console.error("");
  console.error("  Fix:");
  console.error("    1. Copy .env.example to .env");
  console.error("    2. Set EXPO_PUBLIC_DOMAIN to your API domain, e.g.:");
  console.error("         EXPO_PUBLIC_DOMAIN=api.example.com");
  console.error("");
  process.exit(1);
}

console.log(`  ✓ EXPO_PUBLIC_DOMAIN="${domain}"`);

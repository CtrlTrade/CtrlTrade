---
name: OpenAPI YAML duplicate schema keys
description: Duplicate keys in openapi.yaml components/schemas cause silent codegen failures
---

When multiple task agents edit openapi.yaml and merge conflicts are resolved poorly, duplicate schema keys can appear under `components/schemas`.

**Rule:** After every merge wave, run: `node -e "const fs=require('fs'); const c=fs.readFileSync('lib/api-spec/openapi.yaml','utf8'); const seen=[]; let inS=false; for(const l of c.split('\n')){if(l.trim()==='schemas:')inS=true; if(inS&&/^    \w/.test(l)&&l.endsWith(':')){const k=l.trim().replace(':',''); if(seen.includes(k))console.log('DUP:'+k); else seen.push(k);}};"`

**Why:** yaml.safe_load in Python raises "Map keys must be unique"; in Node.js `@scalar/json-magic` silently discards the second key. Either way, orval codegen produces incorrect or empty generated files, which causes TS errors throughout the codebase.

**How to fix:** Find and remove the duplicate schema block (keep whichever is more complete, usually the later one since it was added intentionally).

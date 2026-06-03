---
name: Seed password hash staleness
description: Why seed re-runs leave stale bcrypt hashes and how to guard against it
---

# Seed password hash staleness

## The rule
Seed scripts that use INSERT-only (no-op on conflict) silently leave the old password hash in the DB when the seed's plaintext password is later changed. Every subsequent `bcrypt.compare()` in the API will return `false`, causing all logins to return 401 with no error log.

**How to apply:** Always re-hash and update `password_hash` in the `else` (user already exists) branch, not just in the `if` (new user) branch. Both `scripts/src/seed.ts` and `scripts/src/seed-acme.ts` now do this.

**Why:** bcrypt hashes are salted — the same password produces a different hash each run. If the hash in the DB was created from a different plaintext password (even if the variable name is the same), comparison always fails. There is no runtime warning from bcryptjs; it just returns `false`.

## How to diagnose
```js
node -e "
const bcrypt = require('.../bcryptjs/index.js');
const stored = '<hash from DB>';
bcrypt.hash('<expected password>', 10, function(e, h) {
  // If this hash != stored (different salt/output), the stored hash is for a different password
  bcrypt.compare('<expected password>', stored, function(e2, r) { console.log('match:', r); });
});
"
```
`match: false` with a correctly-formatted 60-char hash = password mismatch, not a bcrypt bug.

---
name: bcryptjs compare debugging
description: How to diagnose bcrypt.compare() silently returning false for seed users
---

# bcryptjs compare debugging

## The rule
When `bcrypt.compare()` returns `false` for a hash that looks correct (60 chars, `$2b$10$` prefix, right library version), the most likely cause is that the stored hash was generated from a **different plaintext password** than the one being compared. This is not a library bug.

**Why:** bcrypt is deterministic given the same salt, but each `bcrypt.hash()` call generates a new random salt. If the seed ran with password A, stored hash H_A, then the seed's password variable was changed to B, the DB still holds H_A and `compare(B, H_A)` returns `false`.

## How to apply
1. Check `length(password_hash)` in the DB — must be exactly 60.
2. Run the node snippet below to verify the compare directly (bypasses the API server and session complexity).
3. If compare fails, regenerate the hash from the current plaintext and UPDATE the DB row.

```bash
node -e "
const b = require('<workspace>/node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs/index.js');
b.hash('<plaintext>', 10, function(e, h) { console.log('new hash:', h); });
// Separately:
b.compare('<plaintext>', '<stored hash>', function(e, r) { console.log('match:', r); });
"
```

## Response time clue
A login returning 401 in ~90 ms means bcrypt **did** run (confirming the user was found). A near-instant 401 means the user was not found at all.

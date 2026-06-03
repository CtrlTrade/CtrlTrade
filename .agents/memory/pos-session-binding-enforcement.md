---
name: POS session binding enforcement
description: Why the POS licence-mode resolver requires full token binding and how write-gating must re-validate
---

# POS session binding enforcement

A CtrlTradePos® till session token carries three bindings: `licenceKey`, `terminalCode`, and `surface`. The licence-mode resolver (the function behind the write-mode gate and `/v1/pos/me` mode reporting) MUST return `locked` unless **all three** are present. Write endpoints (sales, till-open, transactions, refund) are gated on `full` mode and re-resolve mode on **every** request — never trust the mode baked into the token at login.

**Why:** A partial token (e.g. `licenceKey`+`terminalCode` but no `surface`, as a pre-fix/legacy token could be) otherwise resolved to `full` and bypassed the web/desktop/hybrid surface-type gate. Re-validating per write also makes live revocation/suspension take effect immediately (full→locked) instead of lasting until token expiry. An earlier tenant-wide "load any active licence" fallback was a cross-tenant escalation path and was removed — resolution must use the exact bound licence/terminal only.

**How to apply:**
- Login must require `licenceKey` AND `terminalCode` unconditionally (400 if missing), validate them via `validateLicenceForOpen` (tenant scope + surface-type compat + terminal exists/active/bound/branch-match), and persist the NORMALIZED binding (computed `surface`, validated `terminalCode`) into the signed token.
- `/v1/pos/me` must refuse (401) to refresh a token missing any of the three bindings — otherwise an under-bound token gets perpetuated indefinitely via re-sign.
- Any NEW mutating POS endpoint must attach the full-mode gate, or it reopens the bypass.
- Receipt reprints and till-session close are intentionally allowed in read_only (cash-up/reprint must work when a licence lapses).
- Only the Expo desktop till uses `/v1/pos/login` + `/v1/pos/me`; the web `/app/pos` is overview-only on a separate cookie session — so mandatory binding here does not break the web portal.

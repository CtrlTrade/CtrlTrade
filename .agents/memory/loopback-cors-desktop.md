---
name: Loopback CORS for desktop app
description: Why the API CORS allowlist must accept http://127.0.0.1:<port> loopback origins
---

The CtrlTradePos Electron desktop app serves its bundled Expo web build from an
in-process HTTP server at `http://127.0.0.1:<dynamic-port>` (port chosen by
`server.listen(0)`), then calls the remote API cross-origin. The api-client uses
`credentials: "include"`, so the browser (Chromium in Electron) enforces CORS.

**Rule:** the API CORS `origin` callback must allow loopback origins
(`/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/`) in addition to the static
Replit-domain allowlist, or every desktop API call fails with "Failed to fetch"
(a CORS block surfaces as a generic fetch failure, not an HTTP error).

**Why it's safe:** POS routes authenticate ONLY via signed `Authorization: Bearer`
tokens (HMAC over SESSION_SECRET, bound to licence+terminal+surface), never
cookies. Session cookies are `httpOnly` + `sameSite: lax`. A malicious local page
on a loopback origin still cannot forge a POS token, so credentialed loopback CORS
does not expose tenant data.

**How to apply:** This is a server-side change deployed via Replit Publish, NOT a
desktop rebuild. The GitHub Actions pipeline only builds the installer; an
already-installed desktop app starts working as soon as the prod API is
re-published, provided its baked-in EXPO_PUBLIC_DOMAIN points to the prod domain.

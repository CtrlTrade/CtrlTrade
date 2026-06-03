# SEO Strategy

## In scope
- Public marketing pages in `artifacts/ctrltrade` (`/`, `/features`, `/pricing`, `/industries`, `/integrations`, `/addons`, `/security`, `/contact`, `/crm`, `/ctrltradepos`, `/customer-portal`, `/about`, `/blog`, `/status`)
- Public marketplace pages in `artifacts/ctrltrade` (`/marketplace`, `/marketplace/:slug`)
- Public SEO landing pages in `artifacts/ctrltrade` (industry-specific CRM and EPOS routes)
- Public booking page in `artifacts/ctrltrade` (`/book/:tenantSlug`)

## Out of scope
- Authenticated app routes under `/app/**`
- Admin routes under `/admin/**`
- Partner, portal, reseller, and auth flows unless they create public crawlability issues
- Mobile / desktop app flows in `artifacts/ctrltradepos` except any public web landing shell that affects shared branding or crawlability
- API-only routes in `artifacts/api-server`

## Rendering model
- `artifacts/ctrltrade` is a Vite + React SPA using Wouter client-side routing.
- Production deploy serves `artifacts/ctrltrade/dist/public` as static files with a rewrite from `/*` to `/index.html`.
- Public routes are therefore client-rendered and share one static HTML shell.

## Target audience
- Trade businesses, contractors, suppliers, builders merchants, and field service operators.

## Primary keywords
- CRM software for trade businesses
- Trade counter EPOS
- Field service management software
- Industry-specific CRM terms such as roofing CRM, electrical CRM, plumbing CRM, HVAC CRM, builders merchants CRM

## Dismissed categories
- (None yet)

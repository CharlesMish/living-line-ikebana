# Hosting

Living Line is a static Vite app (relative `base: "./"`). There is no client-side router and no SPA fallback.

GitHub Pages remains the current public page, deployed from `main` by [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) at https://charlesmish.github.io/living-line-ikebana/. Keep that workflow intact.

## Cloudflare Workers Builds

GitHub-connected Cloudflare Workers Builds should:

1. `npm ci`
2. `npm run verify` (`typecheck && test && build && validate-dist`)
3. wrangler-deploy `dist/`

Do not introduce a weaker parallel path that only runs `vite build`. The Cloudflare build must use the same repo contract as GitHub Pages.

`wrangler.jsonc` serves `./dist` with `html_handling: "drop-trailing-slash"`. `workers_dev` is on so `main` has an https URL before any custom domain.

Local check after a successful verify:

```bash
npm run cf:dry-run
```

## URLs

- Preview URLs are the phone-test gate.
- The intended future URL `https://ikebana.cmish.dev/` is **not** attached. Do not add `custom_domain` or `routes`.

## Secrets

Never commit Cloudflare tokens, other credentials, or `.wrangler/` auth/cache. Configure account credentials in the Cloudflare dashboard / CI secrets, not in this repository.

# CoreXLyth — Architecture

## Production

GitHub Pages serves the generated repository root at `https://corexlyth.github.io/corexlyth-site/`. Source lives in `src/` and `public/assets/`. The checked publishing workflow builds Astro, verifies output, replaces only generated root directories and commits the refreshed root. Source pushes and manual dispatch publish normally; a periodic check rebuilds only when the public publication fingerprint changes.

## Content

Private drafts, editorial roles, audit history and publication snapshots live in Supabase's unexposed `cx_private` schema. The source Markdown files are the original five imported posts and provide a migration fallback. Explicit publication snapshots override these files; withdrawal records suppress the fallback. `prepare-content.mjs` creates the public-only `.cache/blog` collection before Astro runs. No private draft is read by CI.

`/hesap/yazilar/` provides private drafting and a sanitized browser preview. Editors save drafts; the owner publishes/withdraws. Save uses optimistic revisions. Publishing updates the interaction registry atomically. See `PUBLISHING.md`, `COMMUNITY.md` and `AUTH-SETUP.md` for operation and permissions.

## Routes and services

- Astro article pages, taxonomy, archive, RSS and sitemap share the same collection.
- Pagefind indexes rendered public article bodies; account/editor routes are noindex and excluded.
- Supabase provides verified membership and checked private RPC gateways. Client configuration contains only the public publishable key.
- The HUD/cyberpunk layout is retained; functionality is tested before visual refinement.
- Node 24, pinned added dependencies and lockfile are used by CI. `npm run build && npm run verify` checks public output.

## Reading

Contents use rendered h2/h3 headings and native details. Native image dialogs support cover/inline images, keyboard navigation, Escape, focus restoration and inert background. Linked images retain their destinations. Raw HTML in Markdown is rendered as text and the resulting HTML tree is sanitized; dangerous URL protocols are removed.

## Rollout

Membership remains in closed test. Music is postponed. Private DB backups/restore drills, custom SMTP, public-launch spam controls and Blogger migration remain separate steps. Publishing is eventually reflected on the static site; GitHub scheduling may exceed the nominal 15-minute check interval. Publication is not proof that the new static pages have deployed; the editor reads the deployed manifest separately.

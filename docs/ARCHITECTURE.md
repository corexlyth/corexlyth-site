# CoreXLyth — Site Architecture & Release Plan

## Production safety

The existing root `index.html` and `assets/` remain the **live GitHub Pages version**.
New Astro source is developed in `src/` and its static copies under `public/`.
Until we deliberately switch the Pages publishing source to GitHub Actions,
**do not remove or replace the existing root site**.

## Architecture

- **UI**: existing CoreXLyth cyberpunk/HUD HTML and CSS, kept visually unchanged during this port.
- **Builder**: Astro. Reusable global layout: `src/layouts/SiteLayout.astro`.
- **Routes**: `src/pages/index.astro` and `src/pages/404.astro` first.
- **Static frontend assets**: `public/assets/`.
- **URL path**: `/corexlyth-site/`, configured via Astro `base`.
- **Tests**: `npm run build && npm run verify` on each pull request.
- **Live site**: continues at https://corexlyth.github.io/corexlyth-site/

## Development

Use Node 24. Run `npm install`, `npm run dev` for development, `npm run build`
and `npm run verify` before deployment.

## Next steps (separate, testable changes)

1. Capture and commit the exact package lockfile, green CI and compare UI screenshots.
2. Switch Pages source to GitHub Actions and deploy Astro only after verified.
3. Extract the repeated category, card, header and footer UI into components.
4. Add real posts using Astro content collections; eliminate placeholder `#` links.
5. Add taxonomy, archive, search, SEO and RSS.
6. After content is stable, implement Supabase auth and member functions securely.

### Note on unfinished controls

The current homepage contains preview-only article cards pointing to `#`.
They are *not published articles* yet. The `MUSIC OFF/ON` toggle is not an
audio player yet; playback awaits licensed media and user-triggered controls.

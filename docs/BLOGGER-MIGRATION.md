# Blogger content transfer

Source: https://corexlyth.blogspot.com/ . The public JSON feed contains 11 published articles. Drafts and Blogger comments are not included in that feed. All 11 articles were converted to the same safe Markdown used by the editor. Source IDs, original URLs, publication/update timestamps, content hashes, local covers and image provenance are recorded in `src/config/blogger-import.json`.

The original Blogger **calendar date** is retained verbatim, rather than reinterpreting its timezone and moving an article to the next date. Publication snapshots store the original complete timestamp. Normal authoring continues to assign dates on the server; this one-time trusted import does not add a date picker or weaken author permissions.

Categories: history → Tarih; the existing Görünmeyen Sistemler series → Görünmeyen Sistemler; other technology articles → Teknoloji. All public labels remain as tags. Hidden `_music_*` labels are intentionally omitted because music is postponed. Series text remains an information box. Existing site articles remain intact.

## Conversion and checks

- `[BÖLÜM]` → section heading; `[KARTLAR]` → list; `[KAYNAK]` → source link.
- Notes, information, warnings and terms → matching callouts; quotations stay quotations.
- Cover/status/position control directives do not appear in the article text. The original cover URL is used, or the first body image when no explicit cover was provided.
- All 81 distinct cover/body image URLs were downloaded, resized to a maximum 1920-pixel edge and encoded as WebP. Files are immutable, content-source-addressed paths under `public/assets/img/blogger/`. Captions, attribution and license links remain in the text. Historical image sources are not replaced with generated images.
- Numbered source references become Markdown footnotes with working fragment/backlinks.
- Links between known Blogger posts are rewritten to the new site. Unknown/external source links stay unchanged.

Preparation is local and does not publish:

```sh
python scripts/import-blogger.py /path/public-feed.json /path/staging
python scripts/check-blogger.py
python scripts/blogger-import-sql.py /path/staging/payloads.json /path/staging/manifest.json > /path/import.sql
```

Image preparation requires Pillow. Conversion and SQL generation otherwise use Python's standard library. The importer aborts on an incomplete feed, unknown image host, failed image, invalid slug or duplicate slug. It does not silently omit failed images. Downloaded assets and manifest must be included in the source before import is deployed.

The generated SQL is an all-or-nothing transaction, uses the sole existing publishing owner, records import provenance in private content history and refuses to overwrite any existing changed draft. An identical re-run is a no-op. It uses the existing private tables and permissions; there is no public import endpoint, extra role or key. Imported articles appear in the regular author library and retain their original date on subsequent saves/republishes.

`npm run verify` checks active imported articles' original dates, every local cover/body image, internal fragment targets and exact legacy alias destinations. Withdrawing a post removes its alias on the next build. Mobile/browser checks cover all 11 articles at 1280, 393 and 320 px, including image loading and horizontal overflow.

## Legacy addresses

The static build creates HTML redirects for the known `/2026/09/*.html` and `/2026/10/*.html` paths **under the new site's `/corexlyth-site/` base**. Each has a canonical link, noindex/follow, a visible fallback link and a client redirect preserving query/fragment.

These are **not HTTP 301s**. They cannot redirect traffic arriving at `corexlyth.blogspot.com`; that requires a separate change to the Blogger template/settings or a future controlled domain/host. No Blogger posts were deleted or changed. Keep the Blogger site available until that source-side transition is deliberately configured.

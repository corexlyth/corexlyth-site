# Account system — project provisioned, dashboard setup pending

The account routes are implemented on PR #4 and remain off production until
dashboard configuration and live email testing are complete.

Project: corexlyth-site (`bhsautccvnwgetfzdvui`), CoreXLyth organization,
Frankfurt (`eu-central-1`). Creation was quoted at $0/month. Database connectivity
and the security advisor check passed. The live Auth settings endpoint returned
HTTP 200 with email authentication and required email confirmation enabled. The public client settings are configured
in this branch; no privileged keys are stored in the client.

## Build configuration

Set the project URL and publishableKey in src/config/public-auth.json, or override
with PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY for Astro builds.
Only modern sb_publishable_ keys are accepted. No service role, secret key or
management token belongs in the static client or the repository. Missing
configuration disables forms; the account menu is hidden. This is a static
GitHub Pages app, not SSR; Supabase JS uses the documented implicit email flow.

The new dependency is pinned and package-lock.json must be committed.

## Supabase settings

Site URL: https://corexlyth.github.io/corexlyth-site/
Exact allowed redirects:
- https://corexlyth.github.io/corexlyth-site/hesap/dogrula/
- https://corexlyth.github.io/corexlyth-site/hesap/sifre-yenile/

Enable email/password sign-in and email confirmations. Set minimum password
length to at least 12 in the service as well as the form. Set up production SMTP
and review delivery/rate limits before opening public registrations. Add only
explicit development redirect URLs as required; avoid production wildcards.

## Behavior and boundaries

Routes: /hesap/, /hesap/giris/, /hesap/kayit/,
/hesap/sifremi-unuttum/, /hesap/sifre-yenile/, /hesap/dogrula/.
All are noindex and omitted from sitemap and Pagefind. Redirects after login
are fixed internal paths. Form inputs/status/email use textContent, never HTML.
Passwords are not trimmed, logged or stored by application code. Supabase owns
session storage/refresh and URL-token parsing. Callback pages use no-referrer.
Missing/expired reset sessions cannot change a password. Error messages avoid
revealing whether an email address is registered. Sign-out is local-device scope.

This change creates no database tables, policies or privileged endpoints.
Account display uses getUser; it is not an authorization boundary. Future
profiles/comments/bookmarks require ownership RLS policies and server validation.
Account deletion/export and moderation are separate follow-up work; these screens
alone do not constitute a complete public membership launch.

## Validation before production

Run npm run build and npm run verify. Test both missing configuration and mocked
Auth HTTP responses with the actual SDK in desktop/mobile Chromium. Live email
confirmation, expired links, logout and reset must then be tested against the
selected Supabase project; mocks do not establish live service correctness.

## Checks performed for this change

- Astro/Pagefind production build and route, script, sitemap and noindex checks passed.
- With the real pinned SDK and mocked Auth HTTP responses, Chromium checks passed
  at 1280px and 393px: signup, password mismatch, reset request, unsigned-in reset
  guard, rejected/successful login, restored session, password update, local logout,
  expired link and an implicit recovery-token callback (including URL cleanup).
- Without configuration, form fieldsets stay disabled and the account link is absent.
- The Supabase project is provisioned. Live email validation remains blocked by
  the dashboard sign-in required to save the production site URL and redirects.

## Remaining activation steps

The connected Supabase plugin can create/read projects but cannot update Auth URL
configuration or SMTP settings. The dashboard required a separate login; the secure
browser sign-in was declined. Do not retry sign-in without a new user request.

Next authorized session: configure the Site URL and exact redirects listed above,
check email confirmations and password requirements, establish delivery settings,
and test registration/confirmation/recovery with a user-controlled email account.
Only then mark the PR ready, run CI and merge for production publication.

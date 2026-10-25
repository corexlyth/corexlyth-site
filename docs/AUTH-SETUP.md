# Account system — closed test

Supabase project: corexlyth-site (`bhsautccvnwgetfzdvui`), CoreXLyth organization,
Frankfurt (`eu-central-1`), creation quoted at $0/month.

## Release scope

Public client settings are connected. publicLaunch=false hides the general
account menu. Direct account routes are published for the owner's closed test;
this flag is a presentation setting, not an authorization mechanism. No private
article content, profiles or user data is exposed by this release. Supabase owns
Auth identities; no public database tables or privileged endpoints are added.

The public API URL and modern publishable key are in src/config/public-auth.json.
PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_PUBLISHABLE_KEY can override them in builds.
Privileged keys, non-HTTPS URLs and partial configurations are rejected at build.
The SDK is pinned; package-lock.json and npm ci are used.

## Saved Supabase configuration

- Site URL: https://corexlyth.github.io/corexlyth-site/
- Exact redirect: https://corexlyth.github.io/corexlyth-site/hesap/dogrula/
- Exact redirect: https://corexlyth.github.io/corexlyth-site/hesap/sifre-yenile/
- Email sign-in and confirmation enabled; anonymous sign-in disabled.
- Minimum password length set to 6 with uppercase, lowercase, digit and symbol
  character groups required through the dashboard after user confirmation.
- Custom SMTP is not configured. Supabase's default SMTP allows only organization
  team addresses and has strict delivery limits. General public launch remains
  blocked until a production email sender is connected and tested.

## Account behavior

/hesap/, /hesap/giris/, /hesap/kayit/, /hesap/sifremi-unuttum/,
/hesap/sifre-yenile/, /hesap/dogrula/ are noindex, outside sitemap and Pagefind.
The static app uses Supabase's documented implicit email flow. Redirects after
login are fixed internal paths. Callback pages use no-referrer. Missing/expired
sessions cannot update passwords. Passwords are not logged, trimmed or stored by
application code. Rendering uses textContent. Sign-out is local-device scope.

Account display uses getUser, not an authorization boundary. Future database
features require ownership RLS policies. Account deletion/export, profile editing,
comments/bookmarks and moderation are follow-up work before broad membership use.

## Validation

Production builds and route/script/SEO checks passed. Real pinned SDK tested with
mocked HTTP responses in Chromium at 1280px and 393px: signup, mismatched passwords,
reset requests, signed-out reset blocking, rejected/successful login, session
restoration, password update, logout, expired links and recovery-token callbacks.
Live Auth settings returned HTTP 200 with email/confirmation enabled. Database
connectivity and security advisor checks passed. Real email confirmation and
recovery are pending the owner's closed test; mocks do not prove mail delivery.

## Next step

Owner signs up at /hesap/kayit/ using their Supabase team email, confirms the email,
then tests login/logout. A password recovery test follows subject to SMTP limits.
Do not request passwords or one-time codes in chat. Configure and test custom SMTP
before setting publicLaunch=true and opening general membership.

## Live input validation

The user requested a minimum of 6 characters with at least one ASCII uppercase
letter, lowercase letter, digit and allowed punctuation mark. Signup and password
reset forms now have a live five-item checklist and a live matching indicator.
Login, signup and forgot-password email fields accept only syntactically valid
@gmail.com addresses (case-insensitive, plus aliases supported), normalize on blur,
and block invalid submission. This is client form validation; it does not establish
mailbox ownership or availability. Confirmation emails remain required.

The user confirmed the server-policy change, and the dashboard save completed.
The minimum is 6 characters with all four character groups required. Run verify
for Gmail/domain-suffix, character-group and minimum-length regression cases.
The default SMTP restrictions and closed-test launch flag remain in place.

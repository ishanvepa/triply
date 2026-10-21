# Authentication (Phase 1, Step 1.4)

Authentication uses Supabase email/password accounts and cookie-based SSR
sessions. Login, signup, confirmation/callback handling, a private account page,
profile-name editing, and current-browser logout are implemented. Profile
creation uses the database trigger deployed in Step 1.3.

Verified on October 19, 2026: four auth-helper tests and three real-browser
scenarios against local Supabase Auth, plus ESLint, TypeScript, a frozen Yarn
install, and the production build. Confirmation emails stayed in the local
Mailpit inbox, and the tests left no local user accounts behind.

| Route | Behavior |
| --- | --- |
| `/login` | Email/password login; preserves a validated `next` destination |
| `/signup` | Name, email, and password; asks the user to confirm email when required |
| `/auth/confirm` | Confirms an email token hash or exchanges a PKCE code |
| `/auth/callback` | Exchanges an OAuth/PKCE code; handles cancelled or invalid links |
| `/settings` | Verified account, email display, profile-name editing, and logout |
| `/trips` | Private placeholder; trip listing/creation remains Phase 2 |
| `/invite/[token]` | Private return destination; validating/accepting invitations remains Step 2.3 |

Login/signup send already authenticated users to their validated destination.
Unconfirmed accounts see a check-email state, without disclosing whether an
email address already has an account. Invalid credentials, confirmation links,
and rate limits have user-facing error messages. Signup passwords have 8–128
characters and are never trimmed or included in returned form state.

## Application configuration

Keep existing Supabase values in `.env.local`. The new optional values are:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
```

The origin defaults to `http://localhost:3000` for local development. Set it to
the HTTPS application origin when deployed. Callbacks use this configured
origin rather than an untrusted Host header. Never add a database password or
service-role key to a `NEXT_PUBLIC_` variable.

In the hosted Supabase Dashboard, **Authentication → URL Configuration**, set
the Site URL to that same origin. Allow the following redirect URLs for local
development, and their equivalent on your production origin:

```text
http://localhost:3000/auth/confirm**
http://localhost:3000/auth/callback**
```

Use explicit production origins; avoid broad production host wildcards. The
checked-in `supabase/config.toml` configures only the local stack, not the
hosted project's Auth settings. `SUPABASE_DB_URL` can apply SQL migrations but
cannot change hosted OAuth, email, or redirect settings.

### Email confirmation

The hosted project had email signup and email confirmation enabled when this
step was implemented. Keep confirmation enabled. The default Supabase
confirmation template works through the PKCE code callback, using the browser
that started signup.

For confirmation links that also work in another browser/device, copy
`supabase/templates/confirmation.html` into **Authentication → Email Templates
→ Confirm signup**. Its link uses:

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a>
```

The signup action always supplies `/auth/confirm?next=...` as `emailRedirectTo`,
so the return destination survives confirmation. Keep the URL allowlist aligned
with the app origin. Configure Supabase's production email delivery/SMTP before
inviting outside testers; provider email limits still apply. No real email was
sent by the automated tests: they use the local Mailpit inbox.

### Optional Google sign-in

Google is disabled in the existing hosted project. The action, button, and PKCE
callback are wired but hidden by default. To enable:

1. Configure a Google OAuth client and add the Supabase callback URL shown in
   **Authentication → Sign In / Providers → Google** to Google Cloud.
2. Add the client ID/secret in the Supabase Dashboard and enable the provider.
   Keep the provider secret out of application environment variables.
3. Configure the application's callback redirect URL as above.
4. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` and restart/rebuild the app.

Google's external consent flow requires those provider credentials and was not
automated. The shared PKCE callback is tested against real local Supabase Auth.

## Session and authorization boundaries

The proxy verifies claims before protected routes and refreshes sessions. It
passes refreshed cookies to the server render and the response, preserving the
Supabase library's cache headers. Authenticated responses and callbacks are
marked private/no-store.

The account page, protected layout, and profile action separately verify the
user with `auth.getUser()`. Profile updates always use that verified user's ID;
they ignore a submitted user ID, and database RLS remains in force. Do not rely
on a layout or a hidden button alone to authorize future trip data/actions.

Return destinations accept only local `/settings`, `/trips`, and `/invite`
paths. External URLs, protocol-relative URLs, backslashes, control characters,
and auth-loop destinations fall back to `/settings`. The proxy replaces the
internal return-path request header, so client headers cannot choose an
unchecked redirect. Logout clears this browser's session and revalidates the
application layout cache; other devices are unaffected.

Protected Server Action POSTs perform their authentication check inside the
action so an expired session produces a Next.js action redirect to login.
The proxy continues refreshing cookies and forwarding the trusted return path;
it redirects ordinary unauthenticated POST navigation with 303 and GET navigation
with 307. A `next-action` header is not an authorization signal, and adding it
to a GET does not bypass route protection.

## Verification

Use Node.js 22.16+. Docker Desktop is needed for the local Supabase browser
tests; running the app against hosted Supabase and running `yarn test:auth`,
lint, typecheck, or build do not require Docker.

```powershell
yarn test:auth
yarn auth:start
yarn playwright install chromium
yarn test:e2e
yarn lint
yarn typecheck
yarn build
```

After browser tests, stop the local stack with `yarn supabase stop`. This
preserves its local database volume. Restart regular development with `yarn dev`.

Stop any existing `yarn dev` process before browser tests: the test server uses
port 3100 and the same Next.js build directory. The Playwright config reads only
**local** Supabase status and overrides the test server's public API values; it
never uses `.env.local`'s hosted credentials for signup. Local test accounts are
deleted afterward. Traces and screenshots are ignored by Git.

Tests cover return-path attacks, input validation, anonymous route protection,
forged cookies, confirmation links, rejected unconfirmed login, automatic
profiles, owner-only profile editing, browser restarts, session refresh, failed
and successful login, invitation return paths, logout, and mobile overflow.
The token-hash and default email/PKCE confirmation flows are both exercised.

No schema migration is needed for Step 1.4. Trip workflows, invitation
acceptance, the shared design system, email changes, and password-recovery UI
remain outside this implementation.

## References

- [Supabase SSR clients and verified sessions](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google)

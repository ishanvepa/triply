# Trip invitations (Phase 2, Step 2.3)

Organizers manage invitations from `/trips/[tripId]`. A generated link opens
`/invite/[token]`; recipients sign in or sign up, return to that URL, and choose
**Join trip**. Successful acceptance redirects to the trip and refreshes Trips
Home. All members can see the group's names and roles, with their own row marked
“You”. Only organizers see invitation management.

## Link management

**Create invitation link** calls the existing `create_trip_invitation` RPC using
the verified user's Supabase client. The database checks organizer access,
generates a cryptographically random token, stores its SHA-256 hash, and applies
the default seven-day expiry. No migration or service-role client is needed.
The app builds the share URL from `NEXT_PUBLIC_SITE_URL`, also used for auth
callbacks. Configure it to the actual app origin before sharing links.

Copy the generated URL before leaving the page: the raw token is returned only
when a link is created and is not recoverable from the database. The management
list queries only IDs, creation/expiry dates, and revocation timestamps. It never
fetches hashes for display. Generating another link does not revoke older ones.

**Copy link** uses the Clipboard API. **Share link** uses the native share sheet
when supported and falls back to copying. Clipboard denial selects the read-only
URL and gives a manual-copy instruction. Cancelling a share sheet leaves the
invitation unchanged. No messages or emails are sent automatically.

Each link shows Active, Expired, or Revoked. Organizers can revoke active links;
updates remain subject to organizer-only RLS. Revocation prevents future joins
through that link and keeps existing members in the group. A generated URL is
hidden once its link is revoked. Timestamps use explicit UTC and 24-hour time.
Status labels reflect the latest render; acceptance always rechecks the database.

## Acceptance and access

Opening a link does not change membership. The landing page provides an explicit
join action and keeps the trip's name and member details private until acceptance.
Malformed tokens display an unavailable state immediately. Structurally valid
tokens are checked when the user submits **Join trip**. Unknown, expired, and
revoked tokens produce the same useful message asking for a new link.

The server action independently verifies the session and validates the token
format before calling `accept_trip_invitation`. The existing RPC locks the
invitation row, checks expiry/revocation, and inserts membership with `ON CONFLICT
DO NOTHING`. Repeated/concurrent acceptance returns the same trip without adding
duplicate members or downgrading an existing organizer. A signed-out submission
returns to login through the existing Server Action auth guard.

Invitation pages are marked noindex/nofollow and use a no-referrer policy.
Session responses remain private/no-store. Tokens are bearer links: recipients
can share them, and organizers control continued access through expiry/revocation.

## Verification

```powershell
yarn test:invitations
yarn lint
yarn typecheck
yarn build
```

For browser integration tests, stop an existing Next.js dev server first, then:

```powershell
yarn auth:start
yarn test:e2e
yarn supabase stop
```

The tests use separate local accounts and cover creation, hash-only storage,
seven-day expiry, copy/share and manual-copy fallback, auth return destinations,
explicit acceptance, group members, repeated/concurrent acceptance, organizer
permissions, revocation, expired/unknown/malformed tokens, and preserving an
organizer's role. Native sharing is stubbed so tests send no messages. Local
fixtures are removed afterward; hosted data and `.env.local` are untouched.

The full flight-planning dashboard remains Step 2.4.

# Flight proposals (Phase 2, Step 2.6)

Members can propose flights for a travel leg and compare the group's options.
The screens follow the [Figma wireframes](https://www.figma.com/design/2HViNFR9Qmm1jSBDBcQ6F8):
flight options (`1:28`), entry methods (`1:45`), manual entry (`1:60`), and
proposal details (`1:75`). They reuse the existing palette, cards, fields,
buttons, and app navigation. Airline names use a consistent text component;
the wireframe's placeholder logos are not presented as official branding.

## Workflow and routes

1. Open a travel-leg card from the trip dashboard.
2. Choose **+ Propose option** on `/trips/[tripId]/legs/[legId]`.
3. The entry-method page at `.../proposals/new` marks booking-link import and
   flight-number lookup as **Coming soon**. Manual entry is selected; Continue
   opens `.../proposals/new/manual`.
4. Save the manual form to return to the shared proposal list. The dashboard's
   proposal count and planning status are refreshed.
5. Open a proposal card to view `.../proposals/[proposalId]`, including its
   full schedule, proposer, optional notes, and booking link.

Both ordinary members and organizers can submit. Creation uses the verified
user's request-scoped Supabase client and the existing `flight_proposals`
table; no new migration or service-role client is needed. Browser tests use
local fixtures only and do not create hosted accounts or planning records.

## Input and validation

Airline is required and trimmed to 1–120 characters. Flight number is optional,
uppercased, and limited to 20 characters. The origin, destination, and departure
date are prefilled from the leg and read-only; server validation independently
checks them against the current leg. Submitted trip, leg, or proposer fields
cannot override the action's scope or the database's `auth.uid()` ownership.

Departure time and arrival date/time are required. Clock inputs use explicit
24-hour `HH:mm` text fields. Dates must be real calendar dates in years
0001–9999, and converted UTC values must remain within that range. Arrival must
follow departure as an instant, allowing overnight flights and earlier-looking
local arrivals when crossing time zones or the date line.

Known airports obtain IANA time zones from the small airport catalog. For an
uncatalogued airport, the traveler must supply its named IANA zone, with native
suggestions; the browser's own time zone is never substituted. Known airport
zones are independently checked on the server.

`@js-temporal/polyfill` converts local schedules into UTC instants on the server.
Clock times skipped by a daylight-saving change are rejected. A clock time
that occurs twice requires an explicit earlier/later choice, which appears
after validation identifies the ambiguity. See the [Temporal time-zone guidance](https://tc39.es/proposal-temporal/docs/timezone.html).
Both UTC instants and the airport time-zone identifiers are stored, matching
the existing database model.

Price is optional and nonnegative, up to `9999999999.99` with at most two decimal
places. Currency is a three-letter code, defaulting to USD. Blank price stores
NULL; a zero price remains zero. Booking URL is optional and must be an absolute
HTTP(S) URL of at most 2,048 characters, without spaces, controls, or embedded
login credentials. URLs are stored without fetching or parsing the remote site.
Notes are optional, trimmed, and limited to 5,000 characters.

Validation identifies the affected fields and focuses the first invalid input.
Failed writes preserve entered values. Pending saves disable controls and
Cancel; otherwise Cancel returns without saving. Independent proposals are
allowed, while pending controls prevent repeated clicks on one save.

## Cards and details

Cards show airline/flight number, explicit currency and price, local departure
and arrival times and dates, airport codes and available country flags, proposer,
and interest counts from the existing vote records. The whole card is a
keyboard-accessible link. Details show the same schedule in an elevated panel,
preserve notes as plain text, and expose optional booking links.

Booking links are checked again before rendering and open in a new tab with
`noopener noreferrer`. The destination hostname is visible, and the page explains
that price and availability must be checked on the booking site. Missing links
and prices have explicit states. No price refresh or booking verification is
claimed.

Interest is read-only in this step. The details page shows the actual interested
count and group size, without treating voters for another option as undecided.
Voting controls, percentages, and organizer selection remain Step 2.7. Proposal
editing/deletion is not added by Step 2.6.

## Access and selected flights

Pages verify membership and scope every proposal lookup by trip, leg, and
proposal ID. Missing and inaccessible proposals share the same unavailable
state. Existing RLS remains active, removed membership applies on the next
request, and signed-out submissions return through login to the manual form.

A selected leg hides the submission action and explains that proposals are
closed. Direct entry-page URLs also show the closed state. The action checks
selection again; the existing database trigger locks the leg and rejects a
proposal if selection commits while the save is pending. Selecting a flight
does not remove the group's existing options.

Loading streams a flight-options skeleton. Query failures show an error and
working retry instead of a false empty list. User-specific data is not cached
across requests.

## Verification

```powershell
yarn test:flights
yarn lint
yarn typecheck
yarn build
yarn auth:start
yarn test:e2e tests/e2e/flights.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/travel-legs.spec.ts
yarn supabase stop
```

All eight flight unit tests and all 16 targeted browser integration checks
passed, along with lint, type checking, and the production build. Browser checks
cover two-account proposal creation/visibility, details and booking links,
forged ownership, optional values, validation and failed-write recovery,
unknown-airport zones, repeated clock times, concurrent selection, membership
and trip/leg boundaries, signed-out submissions, retry, and narrow-screen
overflow. Mobile and desktop screenshots were visually reviewed.

The integration server uses the isolated `.next-e2e` directory and local
Supabase credentials. Fixtures are removed afterward, and temporary grants and
locks are restored in `finally` blocks. Hosted configuration and `.env.local`
are unchanged by these tests.

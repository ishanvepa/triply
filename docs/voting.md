# Voting and group decisions (Step 2.7)

Open **Group decision** from a travel leg's Flight options screen, or **Vote and
view group decision** from proposal details. The route is
`/trips/[tripId]/legs/[legId]/decision`, based on Figma Frame 07 (`1:88`).
It reuses the app's cards, palette, airline names, airport display, and navigation.
The MVP rules take precedence over the wireframe's unanimity placeholder.

## Member workflow

Each current member, including the organizer, has one active vote per leg.
**Vote for this flight** creates it; **Change vote to this flight** moves it to
another proposal. The current choice is labeled **Your vote**. Voting is
optional, and each leg has an independent decision.

Results show vote counts, votes cast, undecided members, and rounded support
percentages. Support divides an option's votes by all current members, including
abstainers. Positive equal totals are labeled **Tied for lead**; zero votes
do not create a leader. Options are sorted by vote count, preserving proposal
order for equal totals. Rounded percentages need not sum to exactly 100%.

**Refresh results** retrieves other members' changes. Results also refresh
after a local submission and when the page is loaded again; there is no realtime
subscription. Removed members' votes and removed proposals' votes cascade out
of the database. Current membership supplies the denominator on the next read.
Proposal deletion and member departure controls are not added by this step.

## Organizer confirmation

The organizer can choose **Review decision** on any proposal, including a
non-leading option or one with no votes. The inline review identifies the flight
and explains that confirming selects it for everyone and closes voting.
**Cancel** makes no write. **Confirm selection** saves the decision and opens
the [Selected Flight screen](selected-flights.md).

After selection, everyone sees the selected airline, the selected proposal's
status, and **Voting closed**. All vote and selection controls are removed.
The dashboard and proposal cards/details reflect the selection. Existing votes
remain available as the group's recorded preferences; results continue to use
current membership rather than claiming a historical snapshot.

Step 3.1 adds the Selected Flight screen and links to it from the dashboard,
options, and decision results. Individual booking status editing remains Step 3.2.
The interface does not expose reopening or replacing a decision.

## Writes and concurrency

All reads and writes use the authenticated, request-scoped Supabase client.
Actions recheck membership, scope the proposal by trip and leg, and check the
organizer role independently of the interface. Submitted ownership/scope fields
are ignored. Selection requires an explicit confirmation field.

Votes use separate UPDATE and INSERT calls because the existing column grants
allow changing only `proposal_id`. Ownership derives from `auth.uid()`, and an
update also filters by the verified user. If two tabs both create the first vote,
the unique `(trip_leg_id, user_id)` key resolves the conflict and the action retries
an update. Repeated submissions cannot create extra votes.

Selection uses a conditional UPDATE requiring both a NULL selection and the
leg's original `updated_at`. A stale confirmation cannot replace another tab's
selection or confirm a changed leg. The database's existing row locks serialize
votes/proposals against selection; its trigger rejects voting once selection
commits. RLS and composite foreign keys enforce membership, organizer authority,
and proposal/leg/trip consistency. No migration or hosted data change is required.

Failed writes report an error and allow retry. Buttons are disabled while their
submission is pending. Removed proposals refresh the remaining options; removed
members receive an unavailable error on stale forms and lose page access.

## Verification

```powershell
yarn test:voting
yarn lint
yarn typecheck
yarn build
yarn auth:start
yarn db:test:concurrency
yarn test:e2e tests/e2e/voting.spec.ts tests/e2e/flights.spec.ts tests/e2e/dashboard.spec.ts
yarn supabase stop
```

Unit checks cover abstentions, current membership, removed proposals, ties, and
zero-member arithmetic. Local browser tests cover multiple members, vote changes,
forged ownership/selection, non-leading selection, cancel, stale confirmation,
closed voting, member removal, proposal removal, failed-write recovery, empty
results, and mobile/desktop layouts. Existing database concurrency tests cover
votes racing selection. Browser fixtures are local only and cleaned up afterward;
temporary grants are restored in `finally` blocks.

Verified: all three voting unit tests, all 16 targeted browser tests (five voting,
six proposals, five dashboard), and all nine database concurrency checks passed.
Lint, type checking, and the production build passed. Mobile and desktop renders
were visually reviewed. The existing app navigation and platform-dependent flag
display are retained.

-- Integration tests run in a rollback-only transaction against local Supabase.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'organizer@example.test'),
  ('00000000-0000-0000-0000-000000000002', 'member@example.test'),
  ('00000000-0000-0000-0000-000000000003', 'outsider@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'other-organizer@example.test');
select is((select count(*) from public.profiles), 4::bigint, 'Auth users receive profiles');

insert into public.trips (id, name, start_date, end_date, created_by) values
  ('10000000-0000-0000-0000-000000000001', 'Europe', '2026-12-01', '2026-12-05', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'Other trip', '2026-12-01', '2026-12-05', '00000000-0000-0000-0000-000000000004');
select is((select role::text from public.trip_members where trip_id = '10000000-0000-0000-0000-000000000001'),
  'organizer', 'Trip creation atomically adds its organizer');
insert into public.trip_members (trip_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
insert into public.trip_legs (id, trip_id, origin_airport, destination_airport, travel_date, position) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'BCN', 'LIS', '2026-12-01', 0),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'CDG', 'AMS', '2026-12-01', 0),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'BCN', 'LIS', '2026-12-01', 1);
insert into public.flight_proposals (id, trip_id, trip_leg_id, proposer_id, airline,
  origin_airport, destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone, price, updated_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002', 'Vueling', 'BCN', 'LIS', '2026-12-01 08:30+00', '2026-12-01 09:30+00', 'Europe/Madrid', 'Europe/Lisbon', 89, '2020-01-01'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001', 'Alternative', 'BCN', 'LIS', '2026-12-01 10:30+00', '2026-12-01 11:30+00', 'Europe/Madrid', 'Europe/Lisbon', 99, now()),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000004', 'Other airline', 'CDG', 'AMS', '2026-12-01 08:30+00', '2026-12-01 09:30+00', 'Europe/Paris', 'Europe/Amsterdam', 100, now());

select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity), 8::bigint, 'RLS is enabled on all eight tables');
select ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  and has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE')), 'Anonymous role has no table grants');
select ok(not has_function_privilege('anon', 'public.accept_trip_invitation(text)', 'EXECUTE'), 'Anonymous users cannot accept invitations');
select ok(not has_function_privilege('anon', 'public.create_trip_invitation(uuid,timestamp with time zone)', 'EXECUTE'), 'Anonymous users cannot create invitations');
select ok(not has_column_privilege('authenticated', 'public.trip_members', 'role', 'UPDATE'), 'Members cannot promote roles');
select ok(not has_column_privilege('authenticated', 'public.flight_votes', 'user_id', 'UPDATE'), 'Vote ownership cannot change');
select ok(not has_column_privilege('authenticated', 'public.flight_bookings', 'user_id', 'INSERT'), 'Booking owners cannot be forged');

-- Outsider cannot read another group's data, even when IDs are known.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.trips), 0::bigint, 'Outsider cannot read trips');
select is((select count(*) from public.trip_members), 0::bigint, 'Outsider cannot read members');
select is((select count(*) from public.trip_legs), 0::bigint, 'Outsider cannot read legs');
select is((select count(*) from public.flight_proposals), 0::bigint, 'Outsider cannot read proposals');
select is((select count(*) from public.profiles), 1::bigint, 'Outsider sees only their own profile');
select throws_ok($$insert into public.trip_members (trip_id, user_id)
  values ('10000000-0000-0000-0000-000000000001', auth.uid())$$,
  '42501', null, 'Direct self-joining cannot bypass invitation validation');
select throws_ok($$insert into public.flight_proposals (trip_id, trip_leg_id, airline,
  origin_airport, destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Intruder',
    'BCN', 'LIS', '2026-12-01 08:30+00', '2026-12-01 09:30+00', 'Europe/Madrid', 'Europe/Lisbon')$$,
  '42501', null, 'Outsider cannot propose a flight');
select throws_ok($$insert into public.flight_votes (trip_id, trip_leg_id, proposal_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Outsider cannot vote');
select throws_ok($$select public.create_trip_invitation('10000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Outsider cannot create invitations');

-- A regular member can see their group and edit only their own records.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.trips), 1::bigint, 'Member sees their trip');
select is((select count(*) from public.trip_members), 2::bigint, 'Member sees their group without recursive policies');
select is((select count(*) from public.profiles), 2::bigint, 'Member sees shared profiles');
select is((select count(*) from public.flight_proposals), 2::bigint, 'Member sees only their group proposals');
select results_eq($$update public.trip_legs set selected_proposal_id = '30000000-0000-0000-0000-000000000001'
  where id = '20000000-0000-0000-0000-000000000001' returning id$$, array[]::uuid[], 'Member cannot select a flight');
select results_eq($$update public.trips set name = 'Hijacked' returning id$$, array[]::uuid[], 'Member cannot edit trip details');
select results_eq($$update public.profiles set display_name = 'Hijacked'
  where id = '00000000-0000-0000-0000-000000000001' returning id$$, array[]::uuid[], 'Member cannot change another profile');
select lives_ok($$update public.profiles set display_name = 'Sam' where id = auth.uid()$$, 'Member can change their display name');
select lives_ok($$update public.flight_proposals set price = 90
  where id = '30000000-0000-0000-0000-000000000001'$$, 'Proposer can edit their flight');
select ok((select updated_at > '2020-01-01'::timestamptz from public.flight_proposals
  where id = '30000000-0000-0000-0000-000000000001'), 'Database maintains update timestamps');
select results_eq($$update public.flight_proposals set price = 1
  where id = '30000000-0000-0000-0000-000000000002' returning id$$, array[]::uuid[], 'Member cannot edit another proposal');
select throws_ok($$update public.flight_proposals set departure_timezone = 'Invented/Zone'
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null, 'Reject invalid airport time zones');
select throws_ok($$update public.flight_proposals set departure_at = '2026-12-02 08:30+00', arrival_at = '2026-12-02 09:30+00'
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null, 'Local departure date must match the leg');
select throws_ok($$update public.flight_proposals set destination_airport = 'BER'
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null, 'Proposal route must match the leg');
select throws_ok($$update public.flight_proposals set price = -1
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null, 'Negative prices fail validation');
select throws_ok($$update public.flight_proposals set arrival_at = departure_at
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null, 'Arrival must follow departure');
select lives_ok($$insert into public.flight_proposals (trip_id, trip_leg_id, airline,
  origin_airport, destination_airport, departure_at, arrival_at, departure_timezone, arrival_timezone)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'New option',
    'BCN', 'LIS', '2026-12-01 12:30+00', '2026-12-01 13:30+00', 'Europe/Madrid', 'Europe/Lisbon')$$,
  'Member can create a proposal');
select is((select proposer_id from public.flight_proposals where airline = 'New option'), auth.uid(), 'Proposer defaults to authenticated user');

select lives_ok($$insert into public.flight_votes (trip_id, trip_leg_id, proposal_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001')$$,
  'Member can vote');
select throws_ok($$insert into public.flight_votes (trip_id, trip_leg_id, proposal_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')$$,
  '23505', null, 'Only one vote per member and leg');
select lives_ok($$update public.flight_votes set proposal_id = '30000000-0000-0000-0000-000000000002'
  where trip_leg_id = '20000000-0000-0000-0000-000000000001'$$, 'Member can change their vote');
select throws_ok($$update public.flight_votes set proposal_id = '30000000-0000-0000-0000-000000000003'
  where trip_leg_id = '20000000-0000-0000-0000-000000000001'$$, '23503', null, 'A vote cannot reference another trip');
select throws_ok($$insert into public.flight_votes (trip_id, trip_leg_id, proposal_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001')$$,
  '23503', null, 'A vote cannot reference another leg of the same trip');
select throws_ok($$insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001')$$,
  '23514', null, 'Cannot report booking status before selection');

-- Organizer creates a trip through client column grants and manages invitations.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok($$insert into public.trips (name, start_date, end_date)
  values ('Created through RLS', '2026-12-01', '2026-12-05') returning id$$, 'Authenticated user can create and return a trip');
select is((select count(*) from public.trip_members where user_id = auth.uid()), 2::bigint, 'New trip adds organizer under RLS');
select throws_ok($$insert into public.trips (name, start_date, end_date)
  values ('Bad dates', '2026-12-05', '2026-12-01')$$, '23514', null, 'Trip date range is validated');
select throws_ok($$update public.trip_legs set selected_proposal_id = '30000000-0000-0000-0000-000000000003'
  where id = '20000000-0000-0000-0000-000000000001'$$, '23503', null, 'Cannot select a flight from another trip');
select throws_ok($$update public.trip_legs set selected_proposal_id = '30000000-0000-0000-0000-000000000001'
  where id = '20000000-0000-0000-0000-000000000003'$$, '23503', null, 'Cannot select a flight from another leg');
select throws_ok($$update public.trip_legs set destination_airport = 'BER'
  where id = '20000000-0000-0000-0000-000000000001'$$, '23514', null, 'Cannot invalidate existing proposal routes');
select lives_ok($$insert into public.flight_votes (trip_id, trip_leg_id, proposal_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001')$$,
  'Organizer can cast their own vote');
select results_eq($$update public.flight_votes set proposal_id = '30000000-0000-0000-0000-000000000001'
  where user_id = '00000000-0000-0000-0000-000000000002' returning user_id$$, array[]::uuid[], 'Organizer cannot modify another member vote');
select results_eq($$delete from public.trip_members where user_id = auth.uid() returning user_id$$,
  array[]::uuid[], 'Organizer cannot orphan a trip by leaving');

reset role;
create temporary table test_invitations (invitation_id uuid, token text, expires_at timestamptz);
grant all on test_invitations to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into test_invitations select * from public.create_trip_invitation('10000000-0000-0000-0000-000000000001');
select ok((select token ~ '^[0-9a-f]{64}$' from test_invitations), 'Invitation token has cryptographic entropy');
select ok((select token <> token_hash from test_invitations join public.trip_invitations on id = invitation_id), 'Only a token hash is persisted');
select throws_ok($$select public.create_trip_invitation('10000000-0000-0000-0000-000000000001', now() - interval '1 hour')$$,
  '23514', null, 'Expired invitation creation is rejected');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.trip_invitations), 0::bigint, 'Non-organizer cannot read invitation hashes');
select throws_ok($$select public.accept_trip_invitation(repeat('a', 64))$$, '22023', null, 'Forged token is rejected');
select throws_ok($$select public.accept_trip_invitation('bad')$$, '22023', null, 'Malformed token is rejected');
select is(public.accept_trip_invitation((select token from test_invitations)), '10000000-0000-0000-0000-000000000001'::uuid, 'Valid invitation associates a new member');
select lives_ok($$select public.accept_trip_invitation((select token from test_invitations))$$, 'Repeated invitation acceptance is idempotent');
select is((select count(*) from public.trip_members where user_id = auth.uid()), 1::bigint, 'Duplicate memberships are prevented');
select is((select role::text from public.trip_members where user_id = auth.uid()), 'member', 'Invitation never grants organizer role');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
update public.trip_invitations set revoked_at = now() where id = (select invitation_id from test_invitations);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select throws_ok($$select public.accept_trip_invitation((select token from test_invitations))$$, '22023', null, 'Revoked invitation is rejected');
reset role;
update public.trip_invitations set revoked_at = null, created_at = now() - interval '2 days', expires_at = now() - interval '1 day';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select throws_ok($$select public.accept_trip_invitation((select token from test_invitations))$$, '22023', null, 'Expired invitation is rejected');
select is((select count(*) from public.flight_votes), 0::bigint, 'Other trip cannot read votes');

-- Selection freezes voting and limits booking records to the selected flight.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok($$update public.trip_legs set selected_proposal_id = '30000000-0000-0000-0000-000000000001'
  where id = '20000000-0000-0000-0000-000000000001'$$, 'Organizer can select a flight');
select throws_ok($$update public.flight_votes set proposal_id = '30000000-0000-0000-0000-000000000002'
  where user_id = auth.uid()$$, '23514', null, 'Selection closes voting');
select throws_ok($$delete from public.flight_votes where user_id = auth.uid()$$, '23514', null, 'Votes cannot be withdrawn after selection');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select throws_ok($$update public.flight_proposals set price = 1
  where id = '30000000-0000-0000-0000-000000000001'$$, '23514', null, 'Selected flight details cannot change');
select throws_ok($$insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')$$,
  '23514', null, 'Booking records must refer to the selected flight');
select lives_ok($$insert into public.flight_bookings (trip_id, trip_leg_id, proposal_id, status)
  values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'planning_to_book')$$,
  'Member can report their booking status');
select lives_ok($$update public.flight_bookings set status = 'booked' where user_id = auth.uid()$$, 'Member can update their own booking');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select status::text from public.flight_bookings), 'booked', 'Organizer can see group booking statuses');
select results_eq($$update public.flight_bookings set status = 'not_joining'
  where user_id = '00000000-0000-0000-0000-000000000002' returning user_id$$,
  array[]::uuid[], 'Organizer cannot change another traveler booking');
select throws_ok($$update public.trip_legs set selected_proposal_id = '30000000-0000-0000-0000-000000000002'
  where id = '20000000-0000-0000-0000-000000000001'$$, '23514', null, 'Selection changes cannot silently carry over booking statuses');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select is((select count(*) from public.flight_bookings), 0::bigint, 'Other group cannot read booking statuses');

-- Cascades must work even with closed votes and existing bookings.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select lives_ok($$delete from public.trip_members where trip_id = '10000000-0000-0000-0000-000000000001' and user_id = auth.uid()$$,
  'Member can leave after selection');
select is((select count(*) from public.trips), 0::bigint, 'Departing member immediately loses access');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.flight_bookings), 0::bigint, 'Leaving removes member booking records');
select is((select count(*) from public.flight_votes), 1::bigint, 'Leaving removes only that member vote');
select lives_ok($$delete from public.trips where id = '10000000-0000-0000-0000-000000000001'$$,
  'Organizer can delete a trip with a selected flight');
reset role;
select is((select count(*) from public.flight_proposals where trip_id = '10000000-0000-0000-0000-000000000001'),
  0::bigint, 'Trip deletion removes its proposals');
select is((select count(*) from public.trips where id = '10000000-0000-0000-0000-000000000002'),
  1::bigint, 'Trip deletion leaves other trips intact');

select * from finish();
rollback;

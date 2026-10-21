begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email) values
  ('60000000-0000-0000-0000-000000000001', 'leg-owner@example.test'),
  ('60000000-0000-0000-0000-000000000002', 'leg-member@example.test'),
  ('60000000-0000-0000-0000-000000000003', 'leg-outsider@example.test');
insert into public.trips (id, name, start_date, end_date, created_by) values
  ('61000000-0000-0000-0000-000000000001', 'Leg tests', '2028-12-01', '2028-12-31', '60000000-0000-0000-0000-000000000001'),
  ('61000000-0000-0000-0000-000000000002', 'Other leg tests', '2028-12-01', '2028-12-31', '60000000-0000-0000-0000-000000000001');
insert into public.trip_members (trip_id, user_id) values
  ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002');
create temporary table leg_fixtures (n integer primary key, id uuid);
grant all on leg_fixtures to authenticated;
select ok(not has_function_privilege('anon', 'public.create_trip_leg(uuid,text,text,date)', 'EXECUTE'), 'Anonymous callers cannot append legs');
select ok(not has_function_privilege('anon', 'public.reorder_trip_legs(uuid,uuid[],uuid[])', 'EXECUTE'), 'Anonymous callers cannot reorder legs');
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000001', true);
insert into leg_fixtures values
  (0, public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'BCN', 'LIS', '2028-12-22')),
  (1, public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'LIS', 'BER', '2028-12-24')),
  (2, public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'BER', 'ATL', '2028-12-28'));
select results_eq($$select position from public.trip_legs where trip_id = '61000000-0000-0000-0000-000000000001' order by position$$,
  array[0,1,2], 'New legs append at unique sequential positions');
select throws_ok($$select public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'BCN', 'BCN', '2028-12-22')$$,
  '23514', null, 'Identical airports are rejected');
select throws_ok($$select public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'bad', 'LIS', '2028-12-22')$$,
  '23514', null, 'Malformed airport codes are rejected');
select throws_ok($$select public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'BCN', 'LIS', null)$$,
  '23502', null, 'Missing dates are rejected');
select lives_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001',
  (select array_agg(id order by n) from leg_fixtures), (select array_agg(id order by n desc) from leg_fixtures))$$,
  'Organizer can atomically reverse an itinerary');
select results_eq($$select id from public.trip_legs where trip_id = '61000000-0000-0000-0000-000000000001' order by position$$,
  $$select id from leg_fixtures order by n desc$$, 'All legs retain their identity after swapping positions');
select results_eq($$select position from public.trip_legs where trip_id = '61000000-0000-0000-0000-000000000001' order by position$$,
  array[0,1,2], 'Reordered positions stay contiguous');
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001',
  (select array_agg(id order by n) from leg_fixtures), (select array_agg(id order by n desc) from leg_fixtures))$$,
  '40001', null, 'Stale displayed order cannot overwrite a newer order');
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001',
  (select array_agg(id order by n desc) from leg_fixtures), (select array_agg(id) from leg_fixtures where n = 0))$$,
  '22023', null, 'Missing legs cannot be silently dropped');
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001',
  (select array_agg(id order by n desc) from leg_fixtures), array[(select id from leg_fixtures where n = 0),
  (select id from leg_fixtures where n = 0), (select id from leg_fixtures where n = 0)])$$,
  '22023', null, 'Duplicate leg IDs are rejected');
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001',
  (select array_agg(id order by n desc) from leg_fixtures), array[null,null,null]::uuid[])$$,
  '22023', null, 'Null leg IDs are rejected');
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001', null, null)$$,
  '22023', null, 'Null arrays are rejected');
select lives_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000002', '{}'::uuid[], '{}'::uuid[])$$,
  'An empty itinerary has a valid empty order');
insert into public.trip_legs (trip_id, origin_airport, destination_airport, travel_date, position)
  values ('61000000-0000-0000-0000-000000000002', 'JFK', 'LHR', '2028-12-20', 0);
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001',
  (select array_agg(id order by n desc) from leg_fixtures),
  (select array_agg(id) from public.trip_legs where trip_id = '61000000-0000-0000-0000-000000000002'))$$,
  '22023', null, 'Legs from another trip cannot be moved into this itinerary');
select results_eq($$select id from public.trip_legs where trip_id = '61000000-0000-0000-0000-000000000001' order by position$$,
  $$select id from leg_fixtures order by n desc$$, 'Rejected reorders never partially update the itinerary');
select lives_ok($$update public.trip_legs set destination_airport = 'KEF' where id = (select id from leg_fixtures where n = 2)$$,
  'Organizer can edit a route without proposals');
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000002', true);
select throws_ok($$select public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'BCN', 'LIS', '2028-12-22')$$,
  '42501', null, 'Ordinary members cannot append legs');
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001', '{}'::uuid[], '{}'::uuid[])$$,
  '42501', null, 'Ordinary members cannot reorder legs');
select results_eq($$update public.trip_legs set destination_airport = 'FCO' returning id$$,
  array[]::uuid[], 'Ordinary members cannot edit leg details');
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000003', true);
select throws_ok($$select public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'BCN', 'LIS', '2028-12-22')$$,
  '42501', null, 'Outsiders cannot append legs');
select throws_ok($$select public.reorder_trip_legs('61000000-0000-0000-0000-000000000001', '{}'::uuid[], '{}'::uuid[])$$,
  '42501', null, 'Outsiders cannot reorder legs');
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select public.create_trip_leg('61000000-0000-0000-0000-000000000001', 'BCN', 'LIS', '2028-12-22')$$,
  '42501', null, 'A missing session cannot append legs');
select * from finish();
rollback;

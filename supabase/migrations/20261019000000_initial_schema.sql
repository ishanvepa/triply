-- Trip planning data. Apply with `yarn db:push` after linking the project.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.trip_member_role as enum ('organizer', 'member');
create type public.booking_status as enum (
  'not_decided', 'planning_to_book', 'booked', 'not_joining'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Traveler'
    check (length(btrim(display_name)) between 1 and 80),
  avatar_url text check (avatar_url is null or
    (length(avatar_url) <= 2048 and avatar_url ~ '^https?://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (length(description) <= 5000),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.trip_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_id_idx on public.trip_members(user_id, trip_id);
create index trips_created_by_idx on public.trips(created_by);

create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null default auth.uid() references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index trip_invitations_trip_id_idx on public.trip_invitations(trip_id);
create index trip_invitations_created_by_idx on public.trip_invitations(created_by);

create table public.trip_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  origin_airport text not null check (origin_airport ~ '^[A-Z]{3}$'),
  destination_airport text not null check (destination_airport ~ '^[A-Z]{3}$'),
  travel_date date not null,
  position integer not null check (position >= 0),
  selected_proposal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_airport <> destination_airport),
  unique (id, trip_id),
  unique (trip_id, position) deferrable initially immediate
);

create table public.flight_proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  trip_leg_id uuid not null,
  proposer_id uuid not null default auth.uid() references public.profiles(id),
  airline text not null check (length(btrim(airline)) between 1 and 120),
  flight_number text check (length(flight_number) <= 20),
  origin_airport text not null check (origin_airport ~ '^[A-Z]{3}$'),
  destination_airport text not null check (destination_airport ~ '^[A-Z]{3}$'),
  departure_at timestamptz not null,
  arrival_at timestamptz not null check (arrival_at > departure_at),
  departure_timezone text not null,
  arrival_timezone text not null,
  price numeric(12, 2) check (price >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  booking_url text check (booking_url is null or
    (length(booking_url) <= 2048 and booking_url ~ '^https?://')),
  notes text check (length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_leg_id, trip_id) references public.trip_legs(id, trip_id)
    on delete cascade,
  check (origin_airport <> destination_airport),
  unique (id, trip_id, trip_leg_id)
);
create index flight_proposals_leg_idx on public.flight_proposals(trip_leg_id, trip_id);
create index flight_proposals_trip_id_idx on public.flight_proposals(trip_id);
create index flight_proposals_proposer_idx on public.flight_proposals(proposer_id);

-- The composite FK prevents selecting a proposal from a different leg/trip.
alter table public.trip_legs add constraint trip_legs_selected_proposal_fkey
  foreign key (selected_proposal_id, trip_id, id)
  references public.flight_proposals(id, trip_id, trip_leg_id);
create index trip_legs_selected_proposal_idx
  on public.trip_legs(selected_proposal_id, trip_id, id)
  where selected_proposal_id is not null;

create table public.flight_votes (
  trip_id uuid not null,
  trip_leg_id uuid not null,
  user_id uuid not null default auth.uid(),
  proposal_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_leg_id, user_id),
  foreign key (trip_id, user_id) references public.trip_members(trip_id, user_id)
    on delete cascade,
  foreign key (proposal_id, trip_id, trip_leg_id)
    references public.flight_proposals(id, trip_id, trip_leg_id) on delete cascade
);
create index flight_votes_member_idx on public.flight_votes(trip_id, user_id);
create index flight_votes_proposal_idx on public.flight_votes(proposal_id, trip_id, trip_leg_id);

create table public.flight_bookings (
  trip_id uuid not null,
  trip_leg_id uuid not null,
  user_id uuid not null default auth.uid(),
  proposal_id uuid not null,
  status public.booking_status not null default 'not_decided',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_leg_id, user_id),
  foreign key (trip_id, user_id) references public.trip_members(trip_id, user_id)
    on delete cascade,
  foreign key (proposal_id, trip_id, trip_leg_id)
    references public.flight_proposals(id, trip_id, trip_leg_id) on delete cascade
);
create index flight_bookings_member_idx on public.flight_bookings(trip_id, user_id);
create index flight_bookings_proposal_idx on public.flight_bookings(proposal_id, trip_id, trip_leg_id);

-- Membership helpers bypass RLS to avoid policies recursively reading themselves.
-- They only answer questions about auth.uid(), never a caller-supplied user ID.
create function private.is_trip_member(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = (select auth.uid()));
$$;
create function private.is_trip_organizer(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = (select auth.uid()) and role = 'organizer');
$$;
create function private.shares_trip(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_members mine
    join public.trip_members theirs using (trip_id)
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id);
$$;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 80), ''), 'Traveler'));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_profile();
-- Include users who signed up before this migration.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

create function private.add_trip_organizer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.created_by, 'organizer');
  return new;
end;
$$;
create trigger on_trip_created after insert on public.trips
for each row execute function private.add_trip_organizer();

create function private.guard_leg_changes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.origin_airport, new.destination_airport, new.travel_date)
    is distinct from (old.origin_airport, old.destination_airport, old.travel_date)
    and exists (select 1 from public.flight_proposals where trip_leg_id = old.id) then
    raise exception 'Remove proposals before changing the route or travel date' using errcode = '23514';
  end if;
  if new.selected_proposal_id is distinct from old.selected_proposal_id
    and exists (select 1 from public.flight_bookings where trip_leg_id = old.id) then
    raise exception 'Remove booking statuses before changing the selected flight' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_leg_changes before update on public.trip_legs
for each row execute function private.guard_leg_changes();

create function private.guard_flight_proposal() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  leg public.trip_legs;
begin
  -- Serialize proposal/vote/booking changes with organizer selection.
  select * into leg from public.trip_legs
    where id = case when tg_op = 'DELETE' then old.trip_leg_id else new.trip_leg_id end
    for update;
  if not found then
    if tg_op = 'DELETE' then return old; end if; -- Cascading leg/trip deletion.
    raise exception 'Travel leg does not exist' using errcode = '23503';
  end if;
  if leg.selected_proposal_id is not null then
    raise exception 'Flight proposals are closed for this leg' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if (new.trip_id, new.origin_airport, new.destination_airport)
    is distinct from (leg.trip_id, leg.origin_airport, leg.destination_airport) then
    raise exception 'The proposal must match the travel leg route' using errcode = '23514';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.departure_timezone)
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = new.arrival_timezone) then
    raise exception 'Use valid IANA airport time zones' using errcode = '23514';
  end if;
  if (new.departure_at at time zone new.departure_timezone)::date <> leg.travel_date then
    raise exception 'Local departure date must match the travel leg date' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_flight_proposal before insert or update or delete on public.flight_proposals
for each row execute function private.guard_flight_proposal();

create function private.guard_flight_participation() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  leg public.trip_legs;
begin
  select * into leg from public.trip_legs
    where id = case when tg_op = 'DELETE' then old.trip_leg_id else new.trip_leg_id end
    for update;
  if tg_op = 'DELETE' then
    if not found or not exists (select 1 from public.trip_members
      where trip_id = old.trip_id and user_id = old.user_id) then
      return old; -- Allow FK cascades when a leg or membership is removed.
    end if;
  elsif not found then
    raise exception 'Travel leg does not exist' using errcode = '23503';
  end if;
  if tg_table_name = 'flight_votes' then
    if leg.selected_proposal_id is not null then
      raise exception 'Voting is closed for this leg' using errcode = '23514';
    end if;
  elsif tg_op <> 'DELETE' and
    (leg.selected_proposal_id is null or new.proposal_id <> leg.selected_proposal_id) then
    raise exception 'Booking status must refer to the selected flight' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger guard_flight_votes before insert or update or delete on public.flight_votes
for each row execute function private.guard_flight_participation();
create trigger guard_flight_bookings before insert or update or delete on public.flight_bookings
for each row execute function private.guard_flight_participation();

create trigger profiles_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger trips_updated_at before update on public.trips
for each row execute function private.set_updated_at();
create trigger trip_legs_updated_at before update on public.trip_legs
for each row execute function private.set_updated_at();
create trigger flight_proposals_updated_at before update on public.flight_proposals
for each row execute function private.set_updated_at();
create trigger flight_votes_updated_at before update on public.flight_votes
for each row execute function private.set_updated_at();
create trigger flight_bookings_updated_at before update on public.flight_bookings
for each row execute function private.set_updated_at();

-- RLS and column grants are both required. Clients cannot edit ownership, roles,
-- scope IDs or audit timestamps. Membership writes are limited to trusted RPCs.
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.trip_legs enable row level security;
alter table public.flight_proposals enable row level security;
alter table public.flight_votes enable row level security;
alter table public.flight_bookings enable row level security;

revoke all on public.profiles, public.trips, public.trip_members, public.trip_invitations,
  public.trip_legs, public.flight_proposals, public.flight_votes, public.flight_bookings
  from public, anon, authenticated;
grant all on public.profiles, public.trips, public.trip_members, public.trip_invitations,
  public.trip_legs, public.flight_proposals, public.flight_votes, public.flight_bookings
  to service_role;
grant select on public.profiles, public.trips, public.trip_members, public.trip_invitations,
  public.trip_legs, public.flight_proposals, public.flight_votes, public.flight_bookings
  to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant insert (name, description, start_date, end_date),
  update (name, description, start_date, end_date), delete on public.trips to authenticated;
grant delete on public.trip_members to authenticated;
grant update (revoked_at), delete on public.trip_invitations to authenticated;
grant insert (trip_id, origin_airport, destination_airport, travel_date, position),
  update (origin_airport, destination_airport, travel_date, position, selected_proposal_id),
  delete on public.trip_legs to authenticated;
grant insert (trip_id, trip_leg_id, airline, flight_number, origin_airport, destination_airport,
  departure_at, arrival_at, departure_timezone, arrival_timezone, price, currency, booking_url, notes),
  update (airline, flight_number, origin_airport, destination_airport, departure_at, arrival_at,
  departure_timezone, arrival_timezone, price, currency, booking_url, notes),
  delete on public.flight_proposals to authenticated;
grant insert (trip_id, trip_leg_id, proposal_id), update (proposal_id), delete
  on public.flight_votes to authenticated;
grant insert (trip_id, trip_leg_id, proposal_id, status), update (status), delete
  on public.flight_bookings to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_trip(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy trips_read on public.trips for select to authenticated
  using (created_by = (select auth.uid()) or private.is_trip_member(id));
create policy trips_create on public.trips for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy trips_update_organizer on public.trips for update to authenticated
  using (private.is_trip_organizer(id)) with check (private.is_trip_organizer(id));
create policy trips_delete_organizer on public.trips for delete to authenticated
  using (private.is_trip_organizer(id));

create policy trip_members_read on public.trip_members for select to authenticated
  using (private.is_trip_member(trip_id));
create policy trip_members_leave_or_remove on public.trip_members for delete to authenticated
  using (role = 'member' and (user_id = (select auth.uid()) or private.is_trip_organizer(trip_id)));

create policy invitations_read_organizer on public.trip_invitations for select to authenticated
  using (private.is_trip_organizer(trip_id));
create policy invitations_revoke_organizer on public.trip_invitations for update to authenticated
  using (private.is_trip_organizer(trip_id)) with check (private.is_trip_organizer(trip_id));
create policy invitations_delete_organizer on public.trip_invitations for delete to authenticated
  using (private.is_trip_organizer(trip_id));

create policy trip_legs_read on public.trip_legs for select to authenticated
  using (private.is_trip_member(trip_id));
create policy trip_legs_create_organizer on public.trip_legs for insert to authenticated
  with check (private.is_trip_organizer(trip_id));
create policy trip_legs_update_organizer on public.trip_legs for update to authenticated
  using (private.is_trip_organizer(trip_id)) with check (private.is_trip_organizer(trip_id));
create policy trip_legs_delete_organizer on public.trip_legs for delete to authenticated
  using (private.is_trip_organizer(trip_id));

create policy proposals_read on public.flight_proposals for select to authenticated
  using (private.is_trip_member(trip_id));
create policy proposals_create on public.flight_proposals for insert to authenticated
  with check (proposer_id = (select auth.uid()) and private.is_trip_member(trip_id));
create policy proposals_update_own on public.flight_proposals for update to authenticated
  using (proposer_id = (select auth.uid()) and private.is_trip_member(trip_id))
  with check (proposer_id = (select auth.uid()) and private.is_trip_member(trip_id));
create policy proposals_delete_own_or_organizer on public.flight_proposals for delete to authenticated
  using (private.is_trip_member(trip_id) and
    (proposer_id = (select auth.uid()) or private.is_trip_organizer(trip_id)));

create policy votes_read on public.flight_votes for select to authenticated
  using (private.is_trip_member(trip_id));
create policy votes_create_own on public.flight_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_trip_member(trip_id));
create policy votes_update_own on public.flight_votes for update to authenticated
  using (user_id = (select auth.uid()) and private.is_trip_member(trip_id))
  with check (user_id = (select auth.uid()) and private.is_trip_member(trip_id));
create policy votes_delete_own on public.flight_votes for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_trip_member(trip_id));

create policy bookings_read on public.flight_bookings for select to authenticated
  using (private.is_trip_member(trip_id));
create policy bookings_create_own on public.flight_bookings for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_trip_member(trip_id));
create policy bookings_update_own on public.flight_bookings for update to authenticated
  using (user_id = (select auth.uid()) and private.is_trip_member(trip_id))
  with check (user_id = (select auth.uid()) and private.is_trip_member(trip_id));
create policy bookings_delete_own on public.flight_bookings for delete to authenticated
  using (user_id = (select auth.uid()) and private.is_trip_member(trip_id));

create function private.create_trip_invitation(p_trip_id uuid, p_expires_at timestamptz)
returns table (invitation_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  raw_token text;
begin
  if (select auth.uid()) is null or not private.is_trip_organizer(p_trip_id) then
    raise exception 'Only organizers can create invitations' using errcode = '42501';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future' using errcode = '23514';
  end if;
  -- Two cryptographically random UUIDs provide 244 random bits; keep only the hash.
  raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  return query
    insert into public.trip_invitations as invitation (trip_id, token_hash, created_by, expires_at)
    values (p_trip_id, encode(sha256(convert_to(raw_token, 'UTF8')), 'hex'), auth.uid(), p_expires_at)
    returning invitation.id, raw_token, invitation.expires_at;
end;
$$;
create function public.create_trip_invitation(
  p_trip_id uuid, p_expires_at timestamptz default (now() + interval '7 days')
) returns table (invitation_id uuid, token text, expires_at timestamptz)
language sql security invoker set search_path = '' as $$
  select * from private.create_trip_invitation(p_trip_id, p_expires_at);
$$;

create function private.accept_trip_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  invitation public.trip_invitations;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Sign in to accept an invitation' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid or expired invitation' using errcode = '22023';
  end if;
  select * into invitation from public.trip_invitations
    where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') for update;
  if not found or invitation.revoked_at is not null or invitation.expires_at <= now() then
    raise exception 'Invalid or expired invitation' using errcode = '22023';
  end if;
  insert into public.trip_members (trip_id, user_id, role)
    values (invitation.trip_id, current_user_id, 'member') on conflict (trip_id, user_id) do nothing;
  return invitation.trip_id;
end;
$$;
create function public.accept_trip_invitation(p_token text) returns uuid
language sql security invoker set search_path = '' as $$
  select private.accept_trip_invitation(p_token);
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_trip_member(uuid), private.is_trip_organizer(uuid),
  private.shares_trip(uuid), private.create_trip_invitation(uuid, timestamptz),
  private.accept_trip_invitation(text) to authenticated;
revoke execute on function public.create_trip_invitation(uuid, timestamptz),
  public.accept_trip_invitation(text) from public, anon;
grant execute on function public.create_trip_invitation(uuid, timestamptz),
  public.accept_trip_invitation(text) to authenticated;

comment on table public.flight_bookings is
  'Self-reported booking statuses; no purchase verification or automatic participation.';
comment on table public.flight_proposals is
  'Manually entered flights. Times are instants plus airport time zones; prices are snapshots.';
comment on column public.trip_legs.position is
  'Zero-based ordering. The unique constraint can be deferred in a transaction to reorder legs.';

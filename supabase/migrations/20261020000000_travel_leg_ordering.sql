-- Serialize appends and reorders per trip without relaxing the existing RLS.
create function private.create_trip_leg(
  p_trip_id uuid, p_origin_airport text, p_destination_airport text, p_travel_date date
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  leg_id uuid;
  next_position integer;
begin
  if (select auth.uid()) is null or not private.is_trip_organizer(p_trip_id) then
    raise exception 'Only organizers can manage travel legs' using errcode = '42501';
  end if;
  perform id from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'Trip unavailable' using errcode = '42501';
  end if;
  select coalesce(max(position) + 1, 0) into next_position
    from public.trip_legs where trip_id = p_trip_id;
  insert into public.trip_legs (trip_id, origin_airport, destination_airport, travel_date, position)
    values (p_trip_id, p_origin_airport, p_destination_airport, p_travel_date, next_position)
    returning id into leg_id;
  return leg_id;
end;
$$;

create function public.create_trip_leg(
  p_trip_id uuid, p_origin_airport text, p_destination_airport text, p_travel_date date
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.create_trip_leg(p_trip_id, p_origin_airport, p_destination_airport, p_travel_date);
$$;

create function private.reorder_trip_legs(p_trip_id uuid, p_expected_leg_ids uuid[], p_leg_ids uuid[])
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  current_order uuid[];
begin
  if (select auth.uid()) is null or not private.is_trip_organizer(p_trip_id) then
    raise exception 'Only organizers can manage travel legs' using errcode = '42501';
  end if;
  perform id from public.trips where id = p_trip_id for update;
  if not found then
    raise exception 'Trip unavailable' using errcode = '42501';
  end if;
  -- Stable lock order also protects the comparison against concurrent row edits.
  perform id from public.trip_legs where trip_id = p_trip_id order by id for update;
  select coalesce(array_agg(id order by position, id), '{}'::uuid[]) into current_order
    from public.trip_legs where trip_id = p_trip_id;
  if p_expected_leg_ids is null or p_leg_ids is null
    or coalesce(array_ndims(p_expected_leg_ids), 1) <> 1
    or coalesce(array_ndims(p_leg_ids), 1) <> 1 then
    raise exception 'Supply a complete travel leg order' using errcode = '22023';
  end if;
  if p_expected_leg_ids is distinct from current_order then
    raise exception 'The itinerary changed; reload before reordering' using errcode = '40001';
  end if;
  if (select array_agg(id order by id) from unnest(p_leg_ids) as ids(id))
    is distinct from (select array_agg(id order by id) from unnest(current_order) as ids(id)) then
    raise exception 'Order must contain every trip leg exactly once' using errcode = '22023';
  end if;
  -- Swapping unique positions requires one transaction with deferred validation.
  set constraints public.trip_legs_trip_id_position_key deferred;
  update public.trip_legs as leg set position = ordered.ordinality - 1
    from unnest(p_leg_ids) with ordinality as ordered(id, ordinality)
    where leg.trip_id = p_trip_id and leg.id = ordered.id
      and leg.position is distinct from ordered.ordinality - 1;
  set constraints public.trip_legs_trip_id_position_key immediate;
end;
$$;

create function public.reorder_trip_legs(p_trip_id uuid, p_expected_leg_ids uuid[], p_leg_ids uuid[])
returns void
language sql security invoker set search_path = '' as $$
  select private.reorder_trip_legs(p_trip_id, p_expected_leg_ids, p_leg_ids);
$$;

revoke execute on function private.create_trip_leg(uuid, text, text, date),
  public.create_trip_leg(uuid, text, text, date),
  private.reorder_trip_legs(uuid, uuid[], uuid[]), public.reorder_trip_legs(uuid, uuid[], uuid[])
  from public, anon, authenticated;
grant execute on function private.create_trip_leg(uuid, text, text, date),
  public.create_trip_leg(uuid, text, text, date),
  private.reorder_trip_legs(uuid, uuid[], uuid[]), public.reorder_trip_legs(uuid, uuid[], uuid[])
  to authenticated;

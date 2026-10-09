create table public.riders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  phone text not null check (length(phone) between 9 and 15),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.riders to authenticated;
grant all on public.riders to service_role;
alter table public.riders enable row level security;
create policy "riders admin all" on public.riders for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.orders add column rider_id uuid references public.riders(id) on delete set null;
alter table public.orders add column delivered_at timestamptz;
alter table public.orders add column refunded_amount numeric not null default 0;

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);
grant select on public.order_events to authenticated;
grant all on public.order_events to service_role;
alter table public.order_events enable row level security;
create policy "order events read own" on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create table public.sms_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  phone text not null,
  message text not null,
  status text not null default 'queued',
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.sms_outbox to authenticated;
grant all on public.sms_outbox to service_role;
alter table public.sms_outbox enable row level security;
create policy "sms admin read" on public.sms_outbox for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null,
  reason text not null,
  status text not null default 'requested',
  refund_amount numeric not null default 0,
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create unique index return_one_open_per_order on public.return_requests(order_id) where status = 'requested';
grant select on public.return_requests to authenticated;
grant all on public.return_requests to service_role;
alter table public.return_requests enable row level security;
create policy "returns read own" on public.return_requests for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Log status changes + queue SMS
create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare msg text; rider record;
begin
  if tg_op = 'INSERT' then
    insert into public.order_events(order_id, status, created_by) values (new.id, new.status, auth.uid());
    insert into public.sms_outbox(order_id, phone, message) values (new.id, new.customer_phone,
      'ABAWINA MALL: We received order ' || new.order_no || ' (KSh ' || new.total || '). Track it at abawina mall /track.');
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'delivered' then new.delivered_at := now(); end if;
    insert into public.order_events(order_id, status, created_by) values (new.id, new.status, auth.uid());
    if new.status = 'dispatched' and new.rider_id is not null then
      select * into rider from public.riders where id = new.rider_id;
    end if;
    msg := case new.status
      when 'confirmed' then 'ABAWINA MALL: Order ' || new.order_no || ' is confirmed and being packed.'
      when 'dispatched' then 'ABAWINA MALL: Order ' || new.order_no || ' is on the way.' ||
        coalesce(' Rider: ' || rider.name || ' ' || rider.phone || '.', '')
      when 'delivered' then 'ABAWINA MALL: Order ' || new.order_no || ' was delivered. Thank you for shopping with us!'
      when 'cancelled' then 'ABAWINA MALL: Order ' || new.order_no || ' was cancelled. Call us if this is unexpected.'
      else null end;
    if msg is not null then
      insert into public.sms_outbox(order_id, phone, message) values (new.id, new.customer_phone, msg);
    end if;
  end if;
  return new;
end; $$;
revoke execute on function public.log_order_status() from public, anon, authenticated;
create trigger orders_log_status_upd before update on public.orders for each row execute function public.log_order_status();

create or replace function public.log_order_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.total > 0 and old.total = 0 then
    insert into public.order_events(order_id, status) values (new.id, 'new');
    insert into public.sms_outbox(order_id, phone, message) values (new.id, new.customer_phone,
      'ABAWINA MALL: We received order ' || new.order_no || ' (KSh ' || new.total || '). We will text you when it ships.');
  end if;
  return new;
end; $$;
revoke execute on function public.log_order_created() from public, anon, authenticated;
create trigger orders_log_created after update of total on public.orders for each row execute function public.log_order_created();

create or replace function public.request_return(_order_id uuid, _reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; rid uuid;
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  if length(trim(coalesce(_reason,''))) not between 5 and 1000 then raise exception 'Tell us briefly why you want to return this order'; end if;
  select * into o from public.orders where id = _order_id and user_id = auth.uid();
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'delivered' then raise exception 'Only delivered orders can be returned'; end if;
  if o.delivered_at is not null and o.delivered_at < now() - interval '7 days' then
    raise exception 'The 7-day return window for this order has closed';
  end if;
  if exists (select 1 from public.return_requests where order_id = _order_id and status in ('requested','approved','refunded')) then
    raise exception 'A return has already been requested for this order';
  end if;
  insert into public.return_requests(order_id, user_id, reason) values (_order_id, auth.uid(), left(trim(_reason),1000)) returning id into rid;
  insert into public.order_events(order_id, status, note, created_by) values (_order_id, 'return_requested', left(trim(_reason),200), auth.uid());
  return rid;
end; $$;
revoke execute on function public.request_return(uuid, text) from public, anon;
grant execute on function public.request_return(uuid, text) to authenticated;

create or replace function public.resolve_return(_id uuid, _decision text, _refund numeric, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.return_requests%rowtype; o public.orders%rowtype; amt numeric := coalesce(_refund,0); msg text;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
  select * into r from public.return_requests where id = _id for update;
  if not found then raise exception 'Return not found'; end if;
  select * into o from public.orders where id = r.order_id for update;
  if _decision = 'rejected' then
    if r.status <> 'requested' then raise exception 'This return is already resolved'; end if;
    update public.return_requests set status='rejected', admin_note=left(_note,1000), resolved_at=now(), resolved_by=auth.uid() where id=_id;
    msg := 'ABAWINA MALL: Your return for order ' || o.order_no || ' was not approved.' || coalesce(' ' || left(_note,100), '');
  elsif _decision = 'approved' then
    if r.status <> 'requested' then raise exception 'This return is already resolved'; end if;
    update public.return_requests set status='approved', admin_note=left(_note,1000), resolved_at=now(), resolved_by=auth.uid() where id=_id;
    msg := 'ABAWINA MALL: Your return for order ' || o.order_no || ' is approved. We will contact you to collect the item.';
  elsif _decision = 'refunded' then
    if r.status not in ('requested','approved') then raise exception 'This return cannot be refunded'; end if;
    if amt <= 0 then raise exception 'Enter the refund amount'; end if;
    if amt > o.total - o.refunded_amount then raise exception 'Refund cannot be more than KSh %', o.total - o.refunded_amount; end if;
    update public.return_requests set status='refunded', refund_amount=amt, admin_note=left(_note,1000), resolved_at=now(), resolved_by=auth.uid() where id=_id;
    update public.orders set refunded_amount = refunded_amount + amt,
      payment_status = case when refunded_amount + amt >= total then 'refunded' else 'partially_refunded' end where id = o.id;
    msg := 'ABAWINA MALL: KSh ' || amt || ' has been refunded for order ' || o.order_no || '.';
  else raise exception 'Invalid decision'; end if;
  insert into public.order_events(order_id, status, note, created_by) values (o.id, 'return_' || _decision, left(_note,200), auth.uid());
  insert into public.sms_outbox(order_id, phone, message) values (o.id, o.customer_phone, msg);
end; $$;
revoke execute on function public.resolve_return(uuid, text, numeric, text) from public, anon;
grant execute on function public.resolve_return(uuid, text, numeric, text) to authenticated;

create or replace function public.track_order(_order_no text, _phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders%rowtype; digits text := right(regexp_replace(coalesce(_phone,''),'\D','','g'), 9); rname text;
begin
  if length(digits) < 9 then return null; end if;
  select * into o from public.orders where upper(order_no) = upper(trim(_order_no))
    and right(regexp_replace(customer_phone,'\D','','g'), 9) = digits limit 1;
  if not found then return null; end if;
  select split_part(name,' ',1) into rname from public.riders where id = o.rider_id;
  return jsonb_build_object('order_no', o.order_no, 'status', o.status, 'total', o.total,
    'delivery_zone', o.delivery_zone, 'created_at', o.created_at, 'updated_at', o.updated_at,
    'rider', case when o.status = 'dispatched' then rname end,
    'events', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'at', created_at) order by created_at) from public.order_events where order_id = o.id), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity, 'unit_price', unit_price)) from public.order_items where order_id = o.id), '[]'::jsonb));
end; $$;
-- Phase 1 security hardening
create table if not exists public.role_audit (
  id uuid primary key default gen_random_uuid(),
  target_user uuid not null,
  role public.app_role not null,
  action text not null check (action in ('granted','revoked')),
  changed_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.role_audit to authenticated;
grant all on public.role_audit to service_role;
alter table public.role_audit enable row level security;
create policy "role audit admin read" on public.role_audit for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is not null and not public.has_role(actor, 'admin') then
    raise exception 'Only administrators can change roles';
  end if;
  if tg_op = 'DELETE' then
    if old.role = 'admin' and (select count(*) from public.user_roles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last administrator';
    end if;
    insert into public.role_audit(target_user, role, action, changed_by) values (old.user_id, old.role, 'revoked', actor);
    return old;
  elsif tg_op = 'UPDATE' then
    raise exception 'Role rows cannot be edited; revoke and grant instead';
  end if;
  insert into public.role_audit(target_user, role, action, changed_by) values (new.user_id, new.role, 'granted', actor);
  return new;
end; $$;
revoke execute on function public.guard_role_change() from public, anon, authenticated;
create trigger user_roles_guard before insert or update or delete on public.user_roles
  for each row execute function public.guard_role_change();

revoke insert, update, delete on public.user_roles from anon, authenticated;
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins read roles" on public.user_roles for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.admin_set_staff(_email text, _make_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if uid is null then raise exception 'No account with that email. Ask them to sign up first.'; end if;
  if _make_admin then
    insert into public.user_roles(user_id, role) values (uid,'admin') on conflict do nothing;
  else
    if uid = auth.uid() then raise exception 'You cannot remove your own admin access.'; end if;
    delete from public.user_roles where user_id = uid and role = 'admin';
  end if;
end; $$;
revoke execute on function public.admin_set_staff(text, boolean) from public, anon;
grant execute on function public.admin_set_staff(text, boolean) to authenticated;

-- Orders: no direct inserts with browser-supplied prices
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add constraint orders_payment_status_chk
  check (payment_status in ('unpaid','awaiting_verification','paid','failed','refunded'));
alter table public.products add constraint products_stock_nonneg check (stock_count >= 0) not valid;

revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;
drop policy if exists "orders insert" on public.orders;
drop policy if exists "order items insert" on public.order_items;

create table if not exists public.delivery_zones (
  name text primary key,
  fee numeric(12,2) not null check (fee >= 0),
  active boolean not null default true,
  sort_order int not null default 0
);
grant select on public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.delivery_zones to authenticated;
grant all on public.delivery_zones to service_role;
alter table public.delivery_zones enable row level security;
create policy "zones public read" on public.delivery_zones for select to anon, authenticated using (true);
create policy "zones admin write" on public.delivery_zones for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.place_order(_order jsonb)
returns table(order_id uuid, order_no text, total numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(_order->>'customer_name',''));
  v_phone text := regexp_replace(coalesce(_order->>'customer_phone',''), '[\s-]', '', 'g');
  v_email text := nullif(trim(coalesce(_order->>'customer_email','')),'');
  v_zone text := _order->>'delivery_zone';
  v_method text := coalesce(_order->>'payment_method','');
  v_code text := nullif(upper(trim(coalesce(_order->>'mpesa_code',''))),'');
  v_fee numeric; v_sub numeric := 0; v_order uuid; v_no text;
  it jsonb; p record; v_qty int; v_price numeric;
begin
  if length(v_name) not between 1 and 100 then raise exception 'Please enter your name'; end if;
  if v_phone !~ '^(\+?254|0)(7|1)\d{8}$' then raise exception 'Enter a valid Kenyan phone number'; end if;
  if v_method not in ('mpesa','cash','card') then raise exception 'Invalid payment method'; end if;
  if v_method = 'mpesa' and (v_code is null or v_code !~ '^[A-Z0-9]{10}$') then
    raise exception 'Enter the 10-character M-Pesa transaction code';
  end if;
  if v_method <> 'mpesa' then v_code := null; end if;
  select fee into v_fee from public.delivery_zones where name = v_zone and active;
  if v_fee is null then raise exception 'Choose a valid delivery zone'; end if;
  if jsonb_typeof(_order->'items') is distinct from 'array' or jsonb_array_length(_order->'items') = 0
     or jsonb_array_length(_order->'items') > 50 then
    raise exception 'Your cart is empty';
  end if;
  if v_code is not null and exists (select 1 from public.orders o where o.mpesa_code = v_code) then
    raise exception 'That M-Pesa code has already been used on another order';
  end if;

  insert into public.orders(user_id, customer_name, customer_phone, customer_email, delivery_zone,
    delivery_address, payment_method, mpesa_code, notes, delivery_fee, payment_status)
  values (auth.uid(), v_name, v_phone, v_email, v_zone,
    left(nullif(trim(coalesce(_order->>'delivery_address','')),''), 500), v_method, v_code,
    left(nullif(trim(coalesce(_order->>'notes','')),''), 1000), v_fee,
    case when v_method = 'mpesa' then 'awaiting_verification' else 'unpaid' end)
  returning orders.id, orders.order_no into v_order, v_no;

  for it in select value from jsonb_array_elements(_order->'items') order by value->>'product_id' loop
    v_qty := (it->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 100 then raise exception 'Invalid quantity'; end if;
    select * into p from public.products where id = (it->>'product_id')::uuid and is_published for update;
    if not found then raise exception 'A product in your cart is no longer available'; end if;
    if not p.in_stock or p.stock_count < v_qty then
      raise exception '"%" has only % left in stock', p.name, greatest(p.stock_count,0);
    end if;
    v_price := case when p.flash_price is not null and p.flash_ends_at > now() then p.flash_price else p.price end;
    update public.products set stock_count = stock_count - v_qty,
      in_stock = (stock_count - v_qty) > 0 where id = p.id;
    insert into public.order_items(order_id, product_id, product_name, unit_price, quantity)
      values (v_order, p.id, p.name, v_price, v_qty);
    v_sub := v_sub + v_price * v_qty;
  end loop;

  update public.orders set subtotal = v_sub, total = v_sub + v_fee where id = v_order;
  return query select v_order, v_no, v_sub + v_fee;
end; $$;
revoke execute on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

create or replace function public.restock_on_cancel() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.products p set stock_count = p.stock_count + oi.quantity, in_stock = true
      from public.order_items oi where oi.order_id = new.id and oi.product_id = p.id;
  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened; create a new order';
  end if;
  return new;
end; $$;
revoke execute on function public.restock_on_cancel() from public, anon, authenticated;
create trigger orders_restock before update of status on public.orders
  for each row execute function public.restock_on_cancel();

create or replace function public.bump_campaign_metric(_campaign_id uuid, _metric text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _metric = 'views' then update public.campaigns set views = views + 1 where id = _campaign_id and status = 'live';
  elsif _metric = 'clicks' then update public.campaigns set clicks = clicks + 1 where id = _campaign_id and status = 'live';
  elsif _metric = 'conversions' and auth.uid() is not null then
    update public.campaigns set conversions = conversions + 1 where id = _campaign_id and status = 'live';
  end if;
end; $$;

drop policy if exists "events insert" on public.page_events;
create policy "events insert" on public.page_events for insert to anon, authenticated
  with check (event_type in ('page_view','product_view','search','add_to_cart','checkout_start'));

-- Phase 3: riders, delivery, returns, SMS queue
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

create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare msg text; rider record;
begin
  if tg_op = 'INSERT' then
    insert into public.order_events(order_id, status, created_by) values (new.id, new.status, auth.uid());
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
create trigger orders_log_status_ins after insert on public.orders for each row execute function public.log_order_status();
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
grant execute on function public.track_order(text, text) to anon, authenticated;
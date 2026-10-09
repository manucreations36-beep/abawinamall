-- Phase 1 security hardening (from docs/phase1-security.sql; zone seed data applied separately).

-- 1. Role changes: audited, and only admins may change roles.
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
drop policy if exists "role audit admin read" on public.role_audit;
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
drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard before insert or update or delete on public.user_roles
  for each row execute function public.guard_role_change();

revoke insert, update, delete on public.user_roles from anon, authenticated;
drop policy if exists "admins manage roles" on public.user_roles;
drop policy if exists "admins read roles" on public.user_roles;
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

-- 2. Tighten testimonial policies.
drop policy if exists "testimonials own insert" on public.testimonials;
drop policy if exists "testimonials admin write" on public.testimonials;
drop policy if exists "testimonials admin update" on public.testimonials;
drop policy if exists "testimonials admin delete" on public.testimonials;
drop policy if exists "testimonials insert own" on public.testimonials;
create policy "testimonials admin update" on public.testimonials for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "testimonials admin delete" on public.testimonials for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));
create policy "testimonials insert own" on public.testimonials for insert to authenticated
  with check (user_id = auth.uid() and approved = false and rating between 1 and 5
              and length(message) between 5 and 1000 and length(name) between 1 and 100);

-- 3. Orders: no direct inserts with browser-supplied prices.
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
do $$ begin
  alter table public.orders add constraint orders_payment_status_chk
    check (payment_status in ('unpaid','awaiting_verification','paid','failed','refunded'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.products add constraint products_stock_nonneg check (stock_count >= 0) not valid;
exception when duplicate_object then null; end $$;

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
drop policy if exists "zones public read" on public.delivery_zones;
create policy "zones public read" on public.delivery_zones for select to anon, authenticated using (true);
drop policy if exists "zones admin write" on public.delivery_zones;
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
drop trigger if exists orders_restock on public.orders;
create trigger orders_restock before update of status on public.orders
  for each row execute function public.restock_on_cancel();

-- 4. Campaign metrics: anonymous visitors count views/clicks only.
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
  with check (length(event_type) <= 40 and coalesce(length(path),0) <= 300 and coalesce(length(session_id),0) <= 100);
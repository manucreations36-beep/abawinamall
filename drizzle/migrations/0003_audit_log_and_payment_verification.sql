-- 1. Fix payment-status constraint mismatch: refund logic uses 'partially_refunded'
alter table public.orders drop constraint orders_payment_status_chk;
alter table public.orders add constraint orders_payment_status_chk
  check (payment_status in ('unpaid','awaiting_verification','paid','failed','partially_refunded','refunded'));

-- 2. General-purpose audit log
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs(action, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit logs admin read" on public.audit_logs for select to authenticated
  using (public.has_role(auth.uid(),'admin'));
-- No insert/update/delete policies for app roles: writes happen only inside security-definer functions.

-- 3. Shared audit writer (never callable by clients)
create or replace function public.log_audit(_action text, _entity_type text, _entity_id text,
  _before jsonb default null, _after jsonb default null, _metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, actor_role, action, entity_type, entity_id, before, after, metadata)
  values (auth.uid(),
    case when public.has_role(auth.uid(),'admin') then 'admin' else 'customer' end,
    left(_action,100), left(_entity_type,50), left(_entity_id,100), _before, _after,
    coalesce(_metadata,'{}'::jsonb));
end; $$;
revoke execute on function public.log_audit(text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- 4. Manual M-Pesa verification: admin-only, idempotent, audited
create or replace function public.verify_payment(_order_id uuid, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
  select * into o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.payment_status = 'paid' then raise exception 'This payment is already verified'; end if;
  if o.payment_status not in ('awaiting_verification','unpaid','failed') then
    raise exception 'A % payment cannot be verified', o.payment_status;
  end if;
  if o.payment_method = 'mpesa' and o.mpesa_code is null then
    raise exception 'This order has no M-Pesa transaction code to verify';
  end if;
  update public.orders set payment_status = 'paid' where id = _order_id;
  insert into public.order_events(order_id, status, note, created_by)
    values (_order_id, 'payment_verified', left(coalesce(_note,''), 500), auth.uid());
  perform public.log_audit('payment_verified', 'order', _order_id::text,
    jsonb_build_object('payment_status', o.payment_status),
    jsonb_build_object('payment_status', 'paid'),
    jsonb_build_object('mpesa_code', o.mpesa_code, 'note', left(coalesce(_note,''),200)));
  insert into public.sms_outbox(order_id, phone, message) values (_order_id, o.customer_phone,
    'ABAWINA MALL: Payment for order ' || o.order_no || ' is confirmed. Thank you!');
end; $$;
revoke execute on function public.verify_payment(uuid, text) from public, anon;
grant execute on function public.verify_payment(uuid, text) to authenticated;

create or replace function public.reject_payment(_order_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
  if length(trim(coalesce(_reason,''))) < 3 then raise exception 'Give a reason for rejecting this payment'; end if;
  select * into o from public.orders where id = _order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if o.payment_status <> 'awaiting_verification' then
    raise exception 'Only payments awaiting verification can be rejected';
  end if;
  update public.orders set payment_status = 'failed' where id = _order_id;
  insert into public.order_events(order_id, status, note, created_by)
    values (_order_id, 'payment_rejected', left(_reason, 500), auth.uid());
  perform public.log_audit('payment_rejected', 'order', _order_id::text,
    jsonb_build_object('payment_status', o.payment_status),
    jsonb_build_object('payment_status', 'failed'),
    jsonb_build_object('mpesa_code', o.mpesa_code, 'reason', left(_reason,200)));
  insert into public.sms_outbox(order_id, phone, message) values (_order_id, o.customer_phone,
    'ABAWINA MALL: We could not verify the M-Pesa code for order ' || o.order_no || '. Please contact us or place a new order with the correct code.');
end; $$;
revoke execute on function public.reject_payment(uuid, text) from public, anon;
grant execute on function public.reject_payment(uuid, text) to authenticated;

-- 5. Audit role changes (alongside existing role_audit)
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
    perform public.log_audit('role_revoked', 'user_role', old.user_id::text,
      jsonb_build_object('role', old.role), null, null);
    return old;
  elsif tg_op = 'UPDATE' then
    raise exception 'Role rows cannot be edited; revoke and grant instead';
  end if;
  insert into public.role_audit(target_user, role, action, changed_by) values (new.user_id, new.role, 'granted', actor);
  perform public.log_audit('role_granted', 'user_role', new.user_id::text,
    null, jsonb_build_object('role', new.role), null);
  return new;
end; $$;

-- 6. Audit product and inventory changes
create or replace function public.audit_product_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit('product_created', 'product', new.id::text, null,
      jsonb_build_object('name', new.name, 'price', new.price, 'stock_count', new.stock_count), null);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit('product_deleted', 'product', old.id::text,
      jsonb_build_object('name', old.name, 'price', old.price), null, null);
    return old;
  end if;
  if new.stock_count is distinct from old.stock_count and (new.price is distinct from old.price or new.name is distinct from old.name or new.is_published is distinct from old.is_published) then
    perform public.log_audit('product_updated', 'product', new.id::text,
      jsonb_build_object('name', old.name, 'price', old.price, 'stock_count', old.stock_count, 'is_published', old.is_published),
      jsonb_build_object('name', new.name, 'price', new.price, 'stock_count', new.stock_count, 'is_published', new.is_published), null);
  elsif new.stock_count is distinct from old.stock_count then
    perform public.log_audit('inventory_adjusted', 'product', new.id::text,
      jsonb_build_object('stock_count', old.stock_count),
      jsonb_build_object('stock_count', new.stock_count), null);
  elsif new.price is distinct from old.price or new.name is distinct from old.name or new.is_published is distinct from old.is_published then
    perform public.log_audit('product_updated', 'product', new.id::text,
      jsonb_build_object('name', old.name, 'price', old.price, 'is_published', old.is_published),
      jsonb_build_object('name', new.name, 'price', new.price, 'is_published', new.is_published), null);
  end if;
  return new;
end; $$;
revoke execute on function public.audit_product_change() from public, anon, authenticated;
create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.audit_product_change();

-- 7. Audit order status changes
create or replace function public.audit_order_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    perform public.log_audit('order_status_changed', 'order', new.id::text,
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status),
      jsonb_build_object('order_no', new.order_no));
  end if;
  if new.rider_id is distinct from old.rider_id then
    perform public.log_audit('rider_assigned', 'order', new.id::text,
      jsonb_build_object('rider_id', old.rider_id), jsonb_build_object('rider_id', new.rider_id),
      jsonb_build_object('order_no', new.order_no));
  end if;
  return new;
end; $$;
revoke execute on function public.audit_order_change() from public, anon, authenticated;
create trigger orders_audit after update on public.orders
  for each row execute function public.audit_order_change();

-- 8. Audit refund decisions inside resolve_return
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
  perform public.log_audit('return_' || _decision, 'return_request', _id::text,
    jsonb_build_object('status', r.status),
    jsonb_build_object('status', _decision, 'refund_amount', case when _decision = 'refunded' then amt else null end),
    jsonb_build_object('order_no', o.order_no, 'note', left(coalesce(_note,''),200)));
  insert into public.sms_outbox(order_id, phone, message) values (o.id, o.customer_phone, msg);
end; $$;
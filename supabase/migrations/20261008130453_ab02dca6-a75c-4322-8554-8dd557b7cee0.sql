create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  location text,
  rating integer not null default 5,
  message text not null,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.testimonials to anon;
grant select, insert, update, delete on public.testimonials to authenticated;
grant all on public.testimonials to service_role;
alter table public.testimonials enable row level security;
create policy "testimonials public read approved" on public.testimonials for select to anon, authenticated
  using (approved or user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "testimonials insert own" on public.testimonials for insert to authenticated
  with check (user_id = auth.uid() and approved = false and rating between 1 and 5 and length(message) between 5 and 1000 and length(name) between 1 and 100);
create policy "testimonials admin update" on public.testimonials for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "testimonials admin delete" on public.testimonials for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create or replace function public.admin_customers()
returns table(id uuid, full_name text, email text, phone text, location text, created_at timestamptz, order_count bigint, total_spent numeric, is_admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
  return query select p.id, p.full_name, p.email, p.phone, p.location, p.created_at,
    (select count(*) from public.orders o where o.user_id = p.id),
    coalesce((select sum(o.total) from public.orders o where o.user_id = p.id and o.status <> 'cancelled'),0),
    public.has_role(p.id,'admin')
  from public.profiles p order by p.created_at desc;
end; $$;

create or replace function public.admin_set_staff(_email text, _make_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(_email)) limit 1;
  if uid is null then raise exception 'No account with that email. Ask them to sign up first.'; end if;
  if _make_admin then
    insert into public.user_roles(user_id, role) values (uid,'admin') on conflict do nothing;
  else
    if uid = auth.uid() then raise exception 'You cannot remove your own admin access.'; end if;
    delete from public.user_roles where user_id = uid and role = 'admin';
  end if;
end; $$;
revoke execute on function public.admin_customers() from anon, public;
revoke execute on function public.admin_set_staff(text, boolean) from anon, public;
grant execute on function public.admin_customers() to authenticated;
grant execute on function public.admin_set_staff(text, boolean) to authenticated;
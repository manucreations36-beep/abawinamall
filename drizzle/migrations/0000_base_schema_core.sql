create type public.app_role as enum ('admin','customer');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, phone text, location text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, location)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'location')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'customer') on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, name text not null, slug text not null unique,
  icon text, image_url text, banner_url text, description text,
  featured_tags text[] not null default '{}', sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "categories public read" on public.categories for select to anon, authenticated using (true);
create policy "categories admin write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique, name text not null,
  category_id uuid references public.categories(id) on delete set null,
  price numeric(12,2) not null default 0, original_price numeric(12,2),
  rating numeric(2,1) not null default 0, reviews_count int not null default 0,
  image_url text, gallery text[] not null default '{}', description text,
  features text[] not null default '{}', in_stock boolean not null default true,
  stock_count int not null default 0, is_featured boolean not null default false,
  is_deal boolean not null default false, is_published boolean not null default true,
  badge text, warranty text, brand text, specs jsonb not null default '{}'::jsonb,
  flash_price numeric(12,2), flash_ends_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "products public read" on public.products for select to anon, authenticated using (is_published or public.has_role(auth.uid(),'admin'));
create policy "products admin write" on public.products for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default 'AB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  user_id uuid, customer_name text not null, customer_phone text not null, customer_email text,
  delivery_zone text, delivery_address text, payment_method text not null default 'mpesa',
  status text not null default 'new', subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  notes text, mpesa_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint orders_mpesa_code_format check (mpesa_code is null or mpesa_code ~ '^[A-Z0-9]{10}$')
);
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders insert" on public.orders for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
create policy "orders read own" on public.orders for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "orders admin update" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null, unit_price numeric(12,2) not null default 0, quantity int not null default 1
);
create index order_items_order_idx on public.order_items(order_id);
grant insert on public.order_items to anon, authenticated;
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "order items insert" on public.order_items for insert to anon, authenticated with check (true);
create policy "order items read own" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.has_role(auth.uid(),'admin'))));

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null, headline text, description text, image_url text,
  discount_label text, discount_percent int,
  category_id uuid references public.categories(id) on delete set null,
  cta_text text default 'Shop now', budget_kes numeric(12,2) not null default 0,
  status text not null default 'draft', starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '30 days'),
  views int not null default 0, clicks int not null default 0, conversions int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.campaigns to anon, authenticated;
grant insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "campaigns public read live" on public.campaigns for select to anon, authenticated
  using ((status = 'live' and now() between starts_at and ends_at) or public.has_role(auth.uid(),'admin'));
create policy "campaigns admin write" on public.campaigns for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.page_events (
  id uuid primary key default gen_random_uuid(), event_type text not null,
  product_id uuid references public.products(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  session_id text, path text, created_at timestamptz not null default now()
);
create index page_events_created_idx on public.page_events(created_at);
grant insert on public.page_events to anon, authenticated;
grant select on public.page_events to authenticated;
grant all on public.page_events to service_role;
alter table public.page_events enable row level security;
create policy "events insert" on public.page_events for insert to anon, authenticated with check (true);
create policy "events admin read" on public.page_events for select to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.bump_campaign_metric(_campaign_id uuid, _metric text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _metric = 'views' then update public.campaigns set views = views + 1 where id = _campaign_id;
  elsif _metric = 'clicks' then update public.campaigns set clicks = clicks + 1 where id = _campaign_id;
  elsif _metric = 'conversions' then update public.campaigns set conversions = conversions + 1 where id = _campaign_id;
  end if;
end; $$;
grant execute on function public.bump_campaign_metric(uuid, text) to anon, authenticated;

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
grant select, insert, delete on public.wishlists to authenticated;
grant all on public.wishlists to service_role;
alter table public.wishlists enable row level security;
create policy "wishlist own" on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null,
  author_name text not null,
  rating int not null,
  comment text,
  created_at timestamptz not null default now(),
  unique (product_id, user_id),
  constraint reviews_rating_range check (rating between 1 and 5)
);
grant select on public.reviews to anon, authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews public read" on public.reviews for select to anon, authenticated using (true);
create policy "reviews insert own" on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy "reviews update own" on public.reviews for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reviews delete own or admin" on public.reviews for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.refresh_product_rating() returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products set
    rating = coalesce((select round(avg(rating)::numeric,1) from public.reviews where product_id = pid), 0),
    reviews_count = (select count(*) from public.reviews where product_id = pid)
  where id = pid;
  return null;
end; $$;
create trigger reviews_refresh after insert or update or delete on public.reviews for each row execute function public.refresh_product_rating();

create or replace function public.track_order(_order_no text, _phone text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders%rowtype; digits text := right(regexp_replace(coalesce(_phone,''),'\D','','g'), 9);
begin
  if length(digits) < 9 then return null; end if;
  select * into o from public.orders where upper(order_no) = upper(trim(_order_no))
    and right(regexp_replace(customer_phone,'\D','','g'), 9) = digits limit 1;
  if not found then return null; end if;
  return jsonb_build_object('order_no', o.order_no, 'status', o.status, 'total', o.total,
    'delivery_zone', o.delivery_zone, 'created_at', o.created_at, 'updated_at', o.updated_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity, 'unit_price', unit_price)) from public.order_items where order_id = o.id), '[]'::jsonb));
end; $$;
grant execute on function public.track_order(text, text) to anon, authenticated;

create policy "product images read" on storage.objects for select to anon, authenticated using (bucket_id = 'product-images');
create policy "product images admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'product-images' and public.has_role(auth.uid(),'admin'));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.refresh_product_rating() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
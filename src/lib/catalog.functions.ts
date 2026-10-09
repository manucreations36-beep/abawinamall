import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const PRODUCT_COLS =
  "id, sku, name, price, original_price, rating, reviews_count, image_url, badge, brand, in_stock, stock_count, is_featured, is_deal, category_id, flash_price, flash_ends_at";

export const getStorefront = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [categories, featured, deals, campaigns, flash] = await Promise.all([
    sb.from("categories").select("*").order("sort_order"),
    sb.from("products").select(PRODUCT_COLS).eq("is_featured", true).limit(12),
    sb.from("products").select(PRODUCT_COLS).eq("is_deal", true).limit(8),
    sb.from("campaigns").select("*").eq("status", "live").order("created_at", { ascending: false }),
    sb.from("products").select(PRODUCT_COLS).not("flash_price", "is", null).gt("flash_ends_at", new Date().toISOString()).order("flash_ends_at").limit(12),
  ]);
  return {
    categories: categories.data ?? [],
    featured: featured.data ?? [],
    deals: deals.data ?? [],
    campaigns: campaigns.data ?? [],
    flash: flash.data ?? [],
  };
});

export const getCategoryPage = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: category } = await sb
      .from("categories")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!category) return { category: null, products: [], categories: [] };
    const [products, categories] = await Promise.all([
      sb
        .from("products")
        .select(PRODUCT_COLS)
        .eq("category_id", category.id)
        .order("created_at", { ascending: false }),
      sb.from("categories").select("id, name, slug, icon, sort_order").order("sort_order"),
    ]);
    return { category, products: products.data ?? [], categories: categories.data ?? [] };
  });

export const getProductPage = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ sku: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: product } = await sb
      .from("products")
      .select("*")
      .eq("sku", data.sku)
      .maybeSingle();
    if (!product) return { product: null, category: null, related: [] };
    const [category, related] = await Promise.all([
      product.category_id
        ? sb.from("categories").select("id, name, slug").eq("id", product.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      product.category_id
        ? sb
            .from("products")
            .select(PRODUCT_COLS)
            .eq("category_id", product.category_id)
            .neq("id", product.id)
            .order("rating", { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [] }),
    ]);
    let list = related.data ?? [];
    if (list.length < 6) {
      const { data: top } = await sb
        .from("products")
        .select(PRODUCT_COLS)
        .neq("id", product.id)
        .order("rating", { ascending: false })
        .limit(12);
      const seen = new Set(list.map((p) => p.id));
      list = [...list, ...(top ?? []).filter((p) => !seen.has(p.id))].slice(0, 6);
    }
    return { product, category: category.data ?? null, related: list };
  });

export const searchProducts = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ q: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const term = data.q.trim();
    if (!term) {
      const { data: all } = await sb.from("products").select(PRODUCT_COLS).order("created_at", { ascending: false }).limit(60);
      return { products: all ?? [] };
    }
    const { data: products } = await sb
      .from("products")
      .select(PRODUCT_COLS)
      .or(`name.ilike.%${term}%,brand.ilike.%${term}%,description.ilike.%${term}%`)
      .limit(40);
    return { products: products ?? [] };
  });

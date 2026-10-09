import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProductCard } from "@/components/site/ProductCard";

export const Route = createFileRoute("/wishlist")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My wishlist | ABAWINA MALL" },
      { name: "description", content: "Products you've saved at ABAWINA MALL." },
      { property: "og:title", content: "My wishlist | ABAWINA MALL" },
      { property: "og:description", content: "Products you've saved at ABAWINA MALL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlists")
        .select(
          "created_at, products(id, sku, name, price, original_price, flash_price, flash_ends_at, rating, reviews_count, image_url, badge, in_stock)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => r.products).filter(Boolean);
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="font-display text-2xl font-extrabold">My wishlist</h1>
      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <div className="mt-6 text-sm text-muted-foreground">
          Nothing saved yet. Tap the heart on any product to save it.{" "}
          <Link to="/" className="text-primary hover:underline">Start shopping</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
          {data.map((p) => (p ? <ProductCard key={p.id} product={p} /> : null))}
        </div>
      )}
    </div>
  );
}

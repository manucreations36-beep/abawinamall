import { useRecentlyViewed } from "@/lib/recently-viewed";
import { ProductCard } from "./ProductCard";

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const items = useRecentlyViewed(excludeId).slice(0, 6);
  if (!items.length) return null;
  return (
    <section className="mx-auto mt-14 max-w-7xl">
      <h2 className="font-display text-xl font-bold">Recently viewed</h2>
      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

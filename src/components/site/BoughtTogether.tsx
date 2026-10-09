import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { effectivePrice } from "@/lib/pricing";
import { formatKsh } from "@/lib/store-config";
import { Button } from "@/components/ui/button";

type P = {
  id: string; sku: string | null; name: string; price: number; image_url: string | null;
  in_stock: boolean; flash_price?: number | null; flash_ends_at?: string | null;
};

export function BoughtTogether({ main, others }: { main: P; others: P[] }) {
  const cart = useCart();
  const items = [main, ...others.filter((o) => o.in_stock).slice(0, 2)];
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.map((i) => i.id)));
  if (items.length < 2) return null;
  const chosen = items.filter((i) => picked.has(i.id));
  const total = chosen.reduce((s, i) => s + effectivePrice(i as never), 0);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  return (
    <section className="surface-panel mt-14 p-5">
      <h2 className="font-display text-xl font-bold">Frequently bought together</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {items.map((i, idx) => (
          <div key={i.id} className="flex items-center gap-3">
            {idx > 0 ? <Plus className="size-4 text-muted-foreground" /> : null}
            <label className="flex w-36 cursor-pointer flex-col gap-1 text-xs">
              <div className="aspect-square overflow-hidden rounded-md bg-muted">
                {i.image_url ? <img src={i.image_url} alt={i.name} className="size-full object-cover" loading="lazy" /> : null}
              </div>
              <span className="flex items-start gap-1.5">
                <input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} className="mt-0.5 accent-primary" />
                <span className="line-clamp-2">{idx === 0 ? "This item: " : ""}{i.name}</span>
              </span>
              <span className="font-semibold">{formatKsh(effectivePrice(i as never))}</span>
            </label>
          </div>
        ))}
        <div className="ml-auto flex flex-col gap-2">
          <p className="text-sm">Total for {chosen.length}: <strong>{formatKsh(total)}</strong></p>
          <Button
            disabled={!chosen.length}
            onClick={() => {
              chosen.forEach((i) => cart.add({ id: i.id, sku: i.sku, name: i.name, price: effectivePrice(i as never), image_url: i.image_url }));
              toast.success(`Added ${chosen.length} items to cart`);
            }}
          >
            <ShoppingCart className="size-4" /> Add selected to cart
          </Button>
        </div>
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { Star, ShoppingCart, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatKsh } from "@/lib/store-config";
import { useCart } from "@/lib/cart";
import { compareAtPrice, effectivePrice, isFlashLive } from "@/lib/pricing";
import { WishlistButton } from "./WishlistButton";
import { FlashCountdown } from "./FlashCountdown";

export type ProductCardData = {
  id: string;
  sku: string | null;
  name: string;
  price: number | string;
  original_price: number | string | null;
  flash_price?: number | string | null;
  flash_ends_at?: string | null;
  rating: number | string;
  reviews_count: number;
  image_url: string | null;
  badge: string | null;
  in_stock: boolean;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const cart = useCart();
  const price = effectivePrice(product);
  const original = compareAtPrice(product);
  const flash = isFlashLive(product);
  const off = original ? Math.round(((original - price) / original) * 100) : 0;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <Link
        to="/product/$sku"
        params={{ sku: product.sku ?? product.id }}
        className="relative block aspect-square overflow-hidden bg-secondary"
      >
        {product.image_url ? (
          <img loading="lazy" decoding="async"
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        {off > 0 ? (
          <span className="absolute left-1 top-1 rounded bg-destructive px-1 py-0.5 text-[9px] font-bold text-destructive-foreground sm:text-[10px]">
            -{off}%
          </span>
        ) : product.badge ? (
          <span className="absolute left-1 top-1 rounded bg-primary px-1 py-0.5 text-[9px] font-bold uppercase text-primary-foreground sm:text-[10px]">
            {product.badge}
          </span>
        ) : null}
        <WishlistButton productId={product.id} className="absolute right-1 top-1" />
        {flash && product.flash_ends_at ? (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-destructive/90 py-0.5 text-[9px] font-bold text-destructive-foreground sm:text-[10px]">
            <Zap className="size-3" />
            <FlashCountdown endsAt={product.flash_ends_at} />
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-1.5 sm:p-2">
        <Link
          to="/product/$sku"
          params={{ sku: product.sku ?? product.id }}
          className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground hover:text-primary sm:text-xs"
        >
          {product.name}
        </Link>
        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Star className="size-2.5 fill-accent text-accent" aria-hidden />
          <span>{Number(product.rating).toFixed(1)}</span>
          <span>({product.reviews_count})</span>
        </div>
        <div className="mt-auto">
          <p className="font-display text-xs font-bold text-primary sm:text-sm">{formatKsh(price)}</p>
          {original ? (
            <p className="text-[10px] text-muted-foreground line-through">{formatKsh(original)}</p>
          ) : null}
          <Button
            className="mt-1.5 h-7 w-full gap-1 px-1 text-[10px] sm:text-xs"
            size="sm"
            disabled={!product.in_stock}
            aria-label={product.in_stock ? `Add ${product.name} to cart` : "Out of stock"}
            onClick={() => {
              cart.add({
                id: product.id,
                sku: product.sku,
                name: product.name,
                price,
                image_url: product.image_url,
              });
              toast.success("Added to cart", { description: product.name });
            }}
          >
            <ShoppingCart className="size-3" />
            {product.in_stock ? "Add" : "Sold out"}
          </Button>
        </div>
      </div>
    </div>
  );
}

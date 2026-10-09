import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatKsh } from "@/lib/store-config";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart | ABAWINA MALL" },
      { name: "description", content: "Review the items in your ABAWINA MALL cart before checkout." },
      { property: "og:title", content: "Your cart | ABAWINA MALL" },
      { property: "og:description", content: "Review your items and checkout with M-Pesa or cash on delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Your cart</h1>

      {cart.lines.length === 0 ? (
        <div className="surface-panel mt-6 p-10 text-center">
          <p className="text-muted-foreground">Your cart is empty.</p>
          <Button asChild className="mt-4">
            <Link to="/">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {cart.lines.map((line) => (
              <div key={line.id} className="surface-panel flex gap-4 p-3">
                <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {line.image_url ? (
                    <img loading="lazy" decoding="async" src={line.image_url} alt={line.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{line.name}</p>
                  <p className="mt-1 text-sm text-primary">{formatKsh(line.price)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      aria-label="Decrease quantity"
                      onClick={() => cart.setQuantity(line.id, line.quantity - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-8"
                      aria-label="Increase quantity"
                      onClick={() => cart.setQuantity(line.id, line.quantity + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="ml-auto size-8 text-destructive"
                      aria-label="Remove item"
                      onClick={() => cart.remove(line.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside className="surface-panel h-fit p-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatKsh(cart.subtotal)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Delivery is calculated at checkout based on your zone.
            </p>
            <Button className="mt-5 w-full" size="lg" asChild>
              <Link to="/checkout">Proceed to checkout</Link>
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}

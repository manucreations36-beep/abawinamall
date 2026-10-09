import { Heart } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useToggleWishlist, useWishlistIds } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

export function WishlistButton({ productId, className }: { productId: string; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: ids } = useWishlistIds();
  const toggle = useToggleWishlist();
  const saved = ids?.has(productId) ?? false;

  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) {
          void navigate({ to: "/auth" });
          return;
        }
        toggle.mutate({ productId, saved });
      }}
      className={cn(
        "grid size-7 place-items-center rounded-full bg-background/90 shadow-sm transition hover:scale-105",
        className,
      )}
    >
      <Heart className={cn("size-4", saved ? "fill-destructive text-destructive" : "text-foreground")} />
    </button>
  );
}

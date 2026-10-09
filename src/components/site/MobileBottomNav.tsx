import { Link } from "@tanstack/react-router";
import { Home, LayoutGrid, ShoppingCart, Package, User } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";

const item =
  "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground";
const active = { className: "text-primary" };

export function MobileBottomNav() {
  const cart = useCart();
  const { user } = useAuth();

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
        <Home className="size-5" /> Home
      </Link>
      <Link to="/search" search={{ q: "" }} className={item} activeProps={active}>
        <LayoutGrid className="size-5" /> Browse
      </Link>
      <Link to="/cart" className={item} activeProps={active}>
        <ShoppingCart className="size-5" />
        {cart.count > 0 ? (
          <span className="absolute right-1/2 top-1 translate-x-4 rounded-full bg-primary px-1.5 text-[9px] font-bold text-primary-foreground">
            {cart.count}
          </span>
        ) : null}
        Cart
      </Link>
      {user ? (
        <Link to="/orders" className={item} activeProps={active}>
          <Package className="size-5" /> Orders
        </Link>
      ) : (
        <Link to="/track" search={{ order: "" }} className={item} activeProps={active}>
          <Package className="size-5" /> Track
        </Link>
      )}
      <Link to={user ? "/account" : "/auth"} className={item} activeProps={active}>
        <User className="size-5" /> {user ? "Account" : "Sign in"}
      </Link>
    </nav>
  );
}

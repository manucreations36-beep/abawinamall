import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, Phone, Search, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { STORE } from "@/lib/store-config";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { label: "Appliances", slug: "appliances" },
  { label: "Smart TVs", slug: "tvs" },
  { label: "Sound", slug: "speaker-system" },
  { label: "Kitchen", slug: "kitchen" },
  { label: "Phones", slug: "phone" },
  { label: "Computers", slug: "computer" },
];

export function Header() {
  const cart = useCart();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (term.trim()) navigate({ to: "/search", search: { q: term.trim() } });
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background md:bg-background/95 md:backdrop-blur">
      <div className="hidden items-center justify-between gap-4 border-b border-border/60 px-4 py-1.5 text-xs text-muted-foreground md:flex">
        <span>Fast delivery across Mombasa &amp; countrywide courier</span>
        <a href={`tel:${STORE.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
          <Phone className="size-3.5" /> {STORE.phoneDisplay}
        </a>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <nav className="mt-8 flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.slug}
                  to="/category/$slug"
                  params={{ slug: item.slug }}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="font-display text-lg font-extrabold tracking-tight sm:text-xl">
          <span className="text-gradient-brand">ABAWINA</span>{" "}
          <span className="text-foreground">MALL</span>
        </Link>

        <form onSubmit={submit} className="ml-auto hidden max-w-md flex-1 md:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search fridges, TVs, phones…"
              className="pl-9"
              aria-label="Search products"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account">
                <User className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/account">My account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders">My orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wishlist">My wishlist</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/track" search={{ order: "" }}>Track an order</Link>
                  </DropdownMenuItem>
                  {isAdmin ? (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">Dashboard</Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild>
                  <Link to="/auth">Sign in / Sign up</Link>
                </DropdownMenuItem>
              )}
              {user ? null : (
                <DropdownMenuItem asChild>
                  <Link to="/track" search={{ order: "" }}>Track an order</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" asChild aria-label="Cart" className="relative">
            <Link to="/cart">
              <ShoppingCart className="size-5" />
              {cart.count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {cart.count}
                </span>
              ) : null}
            </Link>
          </Button>
        </div>
      </div>

      <form onSubmit={submit} className="px-4 pb-3 md:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search fridges, TVs, phones…"
            className="h-11 rounded-full pl-9"
            aria-label="Search products"
            type="search"
          />
        </div>
      </form>

      <nav className="hidden gap-1 border-t border-border/60 px-4 py-2 md:flex">
        {NAV.map((item) => (
          <Link
            key={item.slug}
            to="/category/$slug"
            params={{ slug: item.slug }}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

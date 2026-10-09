import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { STORE } from "@/lib/store-config";
import { NewsletterForm } from "./NewsletterForm";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:gap-8 sm:py-12 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <p className="font-display text-lg font-extrabold">
            <span className="text-gradient-brand">ABAWINA</span> MALL
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{STORE.tagline}</p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide">Get deals by email</p>
          <div className="mt-2"><NewsletterForm /></div>
        </div>
        <div className="text-sm">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide">Shop</h3>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link to="/category/$slug" params={{ slug: "appliances" }} className="hover:text-primary">
                Home Appliances
              </Link>
            </li>
            <li>
              <Link to="/category/$slug" params={{ slug: "tvs" }} className="hover:text-primary">
                Smart TVs
              </Link>
            </li>
            <li>
              <Link to="/category/$slug" params={{ slug: "kitchen" }} className="hover:text-primary">
                Kitchen &amp; Dining
              </Link>
            </li>
            <li>
              <Link to="/category/$slug" params={{ slug: "hair" }} className="hover:text-primary">
                Hair &amp; Wigs
              </Link>
            </li>
          </ul>
        </div>
        <div className="order-last col-span-2 text-sm lg:order-none lg:col-span-1">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide">Contact</h3>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" /> {STORE.address}
            </li>
            <li>
              <a href={`tel:${STORE.phone}`} className="flex items-center gap-2 hover:text-primary">
                <Phone className="size-4" /> {STORE.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={`mailto:${STORE.email}`} className="flex items-center gap-2 hover:text-primary">
                <Mail className="size-4" /> {STORE.email}
              </a>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide">Account</h3>
          <ul className="mt-3 space-y-2 text-muted-foreground">
            <li>
              <Link to="/auth" className="hover:text-primary">
                Sign in / Sign up
              </Link>
            </li>
            <li>
              <Link to="/orders" className="hover:text-primary">
                Track my orders
              </Link>
            </li>
            <li>
              <Link to="/cart" className="hover:text-primary">
                Cart &amp; checkout
              </Link>
            </li>
            <li><Link to="/delivery" className="hover:text-primary">Delivery &amp; payment</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Contact us</Link></li>
            <li><Link to="/about" className="hover:text-primary">About us</Link></li>
            <li><Link to="/warranty" className="hover:text-primary">Warranty &amp; returns</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-4 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {STORE.name}. Built by{" "}
        <a
          href={STORE.builtBy.url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-primary hover:underline"
        >
          {STORE.builtBy.name}
        </a>
      </div>
    </footer>
  );
}

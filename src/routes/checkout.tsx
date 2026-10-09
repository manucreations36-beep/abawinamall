import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart } from "@/lib/cart";
import { trackOrderConversion } from "@/lib/track";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DELIVERY_ZONES,
  KE_PHONE_RE,
  MPESA,
  MPESA_CODE_RE,
  PAYMENT_METHODS,
  formatKsh,
  normalizeKePhone,
  whatsappLink,
} from "@/lib/store-config";

const SAVED_DETAILS_KEY = "abawina-checkout-v1";
type SavedDetails = { name: string; phone: string; email: string; zone: string; address: string };

function readSavedDetails(): SavedDetails | null {
  try {
    const raw = localStorage.getItem(SAVED_DETAILS_KEY);
    return raw ? (JSON.parse(raw) as SavedDetails) : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout | ABAWINA MALL" },
      {
        name: "description",
        content:
          "Complete your ABAWINA MALL order — choose your Mombasa delivery zone and pay with M-Pesa, cash or card on delivery.",
      },
      { property: "og:title", content: "Checkout | ABAWINA MALL" },
      {
        property: "og:description",
        content: "Fast Mombasa delivery with M-Pesa, cash or card on delivery.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const cart = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [zone, setZone] = useState<string>(DELIVERY_ZONES[0].name);
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<string>(PAYMENT_METHODS[0].id);
  const [notes, setNotes] = useState("");
  const [mpesaCode, setMpesaCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [placed, setPlaced] = useState<{ order_no: string; total: number } | null>(null);

  // Prefill: saved details from a previous order first, then the signed-in profile.
  useEffect(() => {
    const saved = readSavedDetails();
    if (saved) {
      setName((v) => v || saved.name);
      setPhone((v) => v || saved.phone);
      setEmail((v) => v || saved.email);
      if (DELIVERY_ZONES.some((z) => z.name === saved.zone)) setZone(saved.zone);
      setAddress((v) => v || saved.address);
    }
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, email, phone, location")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setName((v) => v || data.full_name || "");
        setPhone((v) => v || data.phone || "");
        setEmail((v) => v || data.email || user.email || "");
        setAddress((v) => v || data.location || "");
      });
  }, [user]);

  const fee = useMemo(
    () => DELIVERY_ZONES.find((z) => z.name === zone)?.fee ?? 0,
    [zone],
  );
  const total = cart.subtotal + fee;
  const isMpesa = payment === "mpesa";
  const codeValid = MPESA_CODE_RE.test(mpesaCode);
  const helpLink = whatsappLink(
    `Hi ABAWINA MALL, I need help paying ${formatKsh(total)} by M-Pesa to ${MPESA.number}.`,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Please add your name and phone number.");
      return;
    }
    const cleanPhone = normalizeKePhone(phone);
    if (!KE_PHONE_RE.test(cleanPhone)) {
      toast.error("Enter a valid Kenyan phone number, e.g. 0712 345 678.");
      return;
    }
    if (cart.lines.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }
    if (isMpesa && !codeValid) {
      toast.error("Enter the 10-character M-Pesa transaction code (letters and numbers only).");
      return;
    }
    setSaving(true);
    try {
      // Prices, delivery fee and stock are decided by the database, never by the browser.
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: { order_id: string; order_no: string; total: number }[] | null; error: { message: string } | null }>)(
        "place_order",
        {
          _order: {
            customer_name: name.trim(),
            customer_phone: cleanPhone,
            customer_email: email.trim() || null,
            delivery_zone: zone,
            delivery_address: address.trim() || null,
            payment_method: payment,
            mpesa_code: isMpesa ? mpesaCode : null,
            notes: notes.trim() || null,
            items: cart.lines.map((line) => ({ product_id: line.id, quantity: line.quantity })),
          },
        },
      );
      const order = data?.[0];
      if (error || !order) {
        toast.error(error?.message ?? "We couldn't place your order. Please try again.");
        return;
      }

      try {
        localStorage.setItem(
          SAVED_DETAILS_KEY,
          JSON.stringify({ name: name.trim(), phone: cleanPhone, email: email.trim(), zone, address: address.trim() } satisfies SavedDetails),
        );
      } catch {
        /* ignore */
      }
      setPlaced({ order_no: order.order_no, total: Number(order.total) });
      cart.clear();
      void trackOrderConversion();
      toast.success(`Order ${order.order_no} received!`);
    } catch {
      toast.error("We couldn't place the order. Please try again or call us.");
    } finally {
      setSaving(false);
    }
  };

  if (placed) {
    const message = `Hi ABAWINA MALL, I just placed order ${placed.order_no} for ${formatKsh(placed.total)}. Please confirm.`;
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">Order received</h1>
        <p className="mt-3 text-muted-foreground">
          Your order number is <span className="font-semibold text-foreground">{placed.order_no}</span>.
          We'll call you on {phone} to confirm delivery.
        </p>
        <p className="mt-1 text-lg font-semibold">{formatKsh(placed.total)}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <a href={whatsappLink(message)} target="_blank" rel="noreferrer">
              Confirm on WhatsApp
            </a>
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/track", search: { order: placed.order_no } })}>
            Track this order
          </Button>
          {user ? (
            <Button variant="outline" onClick={() => navigate({ to: "/orders" })}>
              View my orders
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to="/">Keep shopping</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Your cart is empty</h1>
        <Button asChild className="mt-5">
          <Link to="/">Start shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Checkout</h1>
      <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="surface-panel space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="phone">Phone (M-Pesa)</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="07XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label>Delivery zone</Label>
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERY_ZONES.map((z) => (
                  <SelectItem key={z.name} value={z.name}>
                    {z.name} — {formatKsh(z.fee)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="address">Estate / street / landmark</Label>
            <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>Payment method</Label>
            <RadioGroup value={payment} onValueChange={setPayment} className="mt-2 space-y-2">
              {PAYMENT_METHODS.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <RadioGroupItem value={m.id} id={`pay-${m.id}`} />
                  <Label htmlFor={`pay-${m.id}`} className="cursor-pointer font-normal">
                    {m.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          {isMpesa ? (
            <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
              <p className="text-sm">
                Send <span className="font-semibold">{formatKsh(total)}</span> via M-Pesa (Send Money) to{" "}
                <span className="font-semibold">{MPESA.display}</span> — {MPESA.name}. Then enter the
                transaction code from your M-Pesa SMS below.
              </p>
              <div>
                <Label htmlFor="mpesa-code">M-Pesa transaction code</Label>
                <Input
                  id="mpesa-code"
                  placeholder="e.g. SJK7AB12CD"
                  maxLength={10}
                  autoCapitalize="characters"
                  value={mpesaCode}
                  onChange={(e) =>
                    setMpesaCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))
                  }
                  required
                />
                <p className={`mt-1 text-xs ${mpesaCode && !codeValid ? "text-destructive" : "text-muted-foreground"}`}>
                  {mpesaCode.length}/10 letters and numbers
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href={helpLink} target="_blank" rel="noreferrer">
                  Having trouble paying? Get help
                </a>
              </Button>
            </div>
          ) : null}
          <div>
            <Label htmlFor="notes">Delivery notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <aside className="surface-panel h-fit p-5">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  {line.image_url ? (
                    <img src={line.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" loading="lazy" />
                  ) : null}
                  <span className="truncate">
                    {line.name} × {line.quantity}
                  </span>
                </span>
                <span className="shrink-0">{formatKsh(line.price * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatKsh(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span>{formatKsh(fee)}</span>
            </div>
            <div className="flex justify-between pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatKsh(total)}</span>
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            className="mt-5 w-full"
            disabled={saving || (isMpesa && !codeValid)}
          >
            {saving ? "Placing order…" : "Place order"}
          </Button>
          <Button variant="ghost" size="sm" className="mt-2 w-full" asChild>
            <a href={helpLink} target="_blank" rel="noreferrer">
              Payment help (WhatsApp)
            </a>
          </Button>
        </aside>
      </form>
    </div>
  );
}

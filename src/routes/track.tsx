import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Circle, PackageSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKsh } from "@/lib/store-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/track")({
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s["order"] === "string" ? s["order"] : "" }),
  head: () => ({
    meta: [
      { title: "Track your order | ABAWINA MALL" },
      { name: "description", content: "Check the delivery status of your ABAWINA MALL order with your order number and phone." },
      { property: "og:title", content: "Track your order | ABAWINA MALL" },
      { property: "og:description", content: "Check where your ABAWINA MALL order is." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrackPage,
});

const STEPS = [
  { key: "new", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "dispatched", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];
const ALIASES: Record<string, number> = { new: 0, pending: 0, paid: 1, confirmed: 1, processing: 1, shipped: 2, dispatched: 2, delivered: 3, completed: 3 };

type Tracked = {
  order_no: string;
  status: string;
  total: number;
  delivery_zone: string | null;
  created_at: string;
  updated_at: string;
  items: { name: string; quantity: number; unit_price: number }[];
  rider?: string | null;
  events?: { status: string; at: string }[];
};
const EVENT_LABEL: Record<string, string> = { new: "Order received", confirmed: "Confirmed", dispatched: "On the way", delivered: "Delivered", cancelled: "Cancelled", return_requested: "Return requested", return_approved: "Return approved", return_rejected: "Return not approved", return_refunded: "Refunded" };

function TrackPage() {
  const search = Route.useSearch();
  const [orderNo, setOrderNo] = useState(search.order);
  const [phone, setPhone] = useState("");

  const lookup = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("track_order", { _order_no: orderNo, _phone: phone });
      if (error) throw error;
      return data as unknown as Tracked | null;
    },
  });

  const o = lookup.data;
  const cancelled = o?.status === "cancelled";
  const stepIdx = o ? (ALIASES[o.status] ?? 0) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
        <PackageSearch className="size-6 text-primary" /> Track your order
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the order number from your confirmation and the phone number you used at checkout.
      </p>
      <form
        className="surface-panel mt-6 grid gap-4 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          lookup.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="order">Order number</Label>
          <Input id="order" required value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="AB-1A2B3C4D" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" inputMode="tel" />
        </div>
        <Button type="submit" disabled={lookup.isPending}>{lookup.isPending ? "Checking…" : "Track"}</Button>
      </form>

      {lookup.isSuccess && !o ? (
        <p className="mt-6 text-sm text-destructive">We couldn't find an order with those details. Check them and try again.</p>
      ) : null}
      {lookup.isError ? <p className="mt-6 text-sm text-destructive">Something went wrong. Please try again.</p> : null}

      {o ? (
        <div className="surface-panel mt-6 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-lg font-bold">{o.order_no}</p>
            <p className="text-sm text-muted-foreground">Placed {new Date(o.created_at).toLocaleDateString("en-KE")}</p>
          </div>
          {cancelled ? (
            <p className="mt-4 font-medium text-destructive">This order was cancelled.</p>
          ) : (
            <ol className="mt-5 grid grid-cols-4 gap-2">
              {STEPS.map((s, i) => (
                <li key={s.key} className="flex flex-col items-center gap-1 text-center text-xs">
                  {i <= stepIdx ? <CheckCircle2 className="size-6 text-success" /> : <Circle className="size-6 text-muted-foreground/40" />}
                  <span className={cn(i <= stepIdx ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
                </li>
              ))}
            </ol>
          )}
          <ul className="mt-5 divide-y divide-border text-sm">
            {o.items.map((it, i) => (
              <li key={i} className="flex justify-between py-2">
                <span>{it.quantity} × {it.name}</span>
                <span>{formatKsh(it.unit_price * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatKsh(o.total)}</span>
          </p>
          {o.delivery_zone ? <p className="mt-1 text-xs text-muted-foreground">Delivering to {o.delivery_zone}</p> : null}
          {o.rider ? <p className="mt-2 text-sm font-medium">Your rider: {o.rider}</p> : null}
          {o.events && o.events.length > 0 ? (
            <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {o.events.map((e, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{EVENT_LABEL[e.status] ?? e.status}</span>
                  <span>{new Date(e.at).toLocaleString("en-KE")}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

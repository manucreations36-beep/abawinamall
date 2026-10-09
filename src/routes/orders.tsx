import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatKsh } from "@/lib/store-config";

export const Route = createFileRoute("/orders")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My orders | ABAWINA MALL" },
      {
        name: "description",
        content: "See your ABAWINA MALL order history, delivery status and returns.",
      },
      { property: "og:title", content: "My orders | ABAWINA MALL" },
      { property: "og:description", content: "Track your ABAWINA MALL deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

const RETURN_LABEL: Record<string, string> = {
  requested: "Return requested",
  approved: "Return approved",
  rejected: "Return not approved",
  refunded: "Refunded",
};

function OrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_no, status, total, refunded_amount, delivered_at, delivery_zone, payment_method, created_at, order_items(product_name, quantity, unit_price), return_requests(status, refund_amount, admin_note)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!user || isLoading) {
    return <div className="px-4 py-20 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-2xl font-bold">My orders</h1>
      {orders.length === 0 ? (
        <div className="surface-panel mt-6 p-10 text-center">
          <p className="text-muted-foreground">You haven't placed an order yet.</p>
          <Button asChild className="mt-4">
            <Link to="/">Start shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => {
            const ret = order.return_requests?.[order.return_requests.length - 1];
            const canReturn =
              order.status === "delivered" &&
              !order.return_requests?.some((r) => r.status !== "rejected") &&
              (!order.delivered_at || Date.now() - new Date(order.delivered_at).getTime() < 7 * 86400000);
            return (
              <div key={order.id} className="surface-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{order.order_no}</p>
                  <div className="flex gap-2">
                    {ret ? <Badge variant="outline">{RETURN_LABEL[ret.status] ?? ret.status}</Badge> : null}
                    <Badge variant={order.status === "delivered" ? "default" : "secondary"}>{order.status}</Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleString("en-KE")} · {order.delivery_zone} · {order.payment_method}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {order.order_items.map((item, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {item.product_name} × {item.quantity}
                      </span>
                      <span>{formatKsh(Number(item.unit_price) * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-right font-semibold">{formatKsh(order.total)}</p>
                {Number(order.refunded_amount) > 0 ? (
                  <p className="text-right text-xs text-muted-foreground">Refunded {formatKsh(order.refunded_amount)}</p>
                ) : null}
                {ret?.admin_note ? <p className="mt-2 text-xs text-muted-foreground">Note from us: {ret.admin_note}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/track" search={{ order: order.order_no }}>Track</Link>
                  </Button>
                  {canReturn ? <ReturnForm orderId={order.id} /> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReturnForm({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_return", { _order_id: orderId, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Return requested. We'll text you once it's reviewed.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["my-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Return this order
      </Button>
    );
  }
  return (
    <form
      className="w-full space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit.mutate();
      }}
    >
      <Textarea required minLength={5} maxLength={1000} placeholder="What's wrong with the item?" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={submit.isPending}>Send request</Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      <p className="text-xs text-muted-foreground">Returns are accepted within 7 days of delivery.</p>
    </form>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatKsh } from "@/lib/store-config";

export function useRiders() {
  return useQuery({
    queryKey: ["riders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("riders").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function RidersTab() {
  const qc = useQueryClient();
  const { data: riders = [] } = useRiders();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("riders").insert({ name: name.trim(), phone: phone.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setPhone("");
      toast.success("Rider added.");
      void qc.invalidateQueries({ queryKey: ["riders"] });
    },
    onError: () => toast.error("Could not add rider. Check the name and phone."),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("riders").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["riders"] }),
  });

  return (
    <div className="mt-4 space-y-4">
      <form
        className="surface-panel grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input required placeholder="Rider name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input required placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" disabled={add.isPending}>Add rider</Button>
      </form>
      {riders.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No riders yet.</p>
      ) : (
        riders.map((r) => (
          <div key={r.id} className="surface-panel flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.phone}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              {r.active ? "Active" : "Off duty"}
              <Switch checked={r.active} onCheckedChange={(active) => toggle.mutate({ id: r.id, active })} />
            </label>
          </div>
        ))
      )}
    </div>
  );
}

export function ReturnsTab() {
  const qc = useQueryClient();
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ["admin-returns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_requests")
        .select("*, orders(order_no, total, refunded_amount, customer_name, customer_phone)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="py-16 text-center text-muted-foreground">Loading returns…</p>;
  if (returns.length === 0) return <p className="py-16 text-center text-muted-foreground">No return requests.</p>;

  return (
    <div className="mt-4 space-y-3">
      {returns.map((r) => (
        <ReturnCard key={r.id} r={r} onDone={() => void qc.invalidateQueries({ queryKey: ["admin-returns"] })} />
      ))}
    </div>
  );
}

type ReturnRow = {
  id: string;
  status: string;
  reason: string;
  refund_amount: number;
  admin_note: string | null;
  created_at: string;
  orders: { order_no: string; total: number; refunded_amount: number; customer_name: string; customer_phone: string } | null;
};

function ReturnCard({ r, onDone }: { r: ReturnRow; onDone: () => void }) {
  const remaining = Number(r.orders?.total ?? 0) - Number(r.orders?.refunded_amount ?? 0);
  const [amount, setAmount] = useState(String(remaining));
  const [note, setNote] = useState("");
  const resolve = useMutation({
    mutationFn: async (decision: string) => {
      const { error } = await supabase.rpc("resolve_return", {
        _id: r.id,
        _decision: decision,
        _refund: decision === "refunded" ? Number(amount) : 0,
        _note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Return updated. The customer will be texted.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const open = r.status === "requested" || r.status === "approved";

  return (
    <div className="surface-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {r.orders?.order_no} · {r.orders?.customer_name} · {r.orders?.customer_phone}
        </p>
        <Badge variant={r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
      </div>
      <p className="mt-2 text-sm">{r.reason}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Requested {new Date(r.created_at).toLocaleString("en-KE")} · Order total {formatKsh(r.orders?.total)}
        {r.status === "refunded" ? ` · Refunded ${formatKsh(r.refund_amount)}` : ""}
      </p>
      {r.admin_note ? <p className="mt-1 text-xs text-muted-foreground">Note: {r.admin_note}</p> : null}
      {open ? (
        <div className="mt-3 space-y-2">
          <Textarea placeholder="Note to customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            {r.status === "requested" ? (
              <>
                <Button size="sm" variant="secondary" disabled={resolve.isPending} onClick={() => resolve.mutate("approved")}>Approve</Button>
                <Button size="sm" variant="destructive" disabled={resolve.isPending} onClick={() => resolve.mutate("rejected")}>Reject</Button>
              </>
            ) : null}
            <Input className="w-32" type="number" min={1} max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate("refunded")}>Mark refunded</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send the money yourself (M-Pesa or cash) first, then mark it refunded here.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function SmsTab() {
  const { data = [] } = useQuery({
    queryKey: ["sms-outbox"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sms_outbox").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm text-muted-foreground">
        Customer text messages are queued here. They will start sending once an SMS provider account is connected.
      </p>
      {data.map((m) => (
        <div key={m.id} className="surface-panel flex flex-wrap justify-between gap-2 p-3 text-sm">
          <span>
            <span className="font-medium">{m.phone}</span> — {m.message}
          </span>
          <Badge variant="secondary">{m.status}</Badge>
        </div>
      ))}
    </div>
  );
}

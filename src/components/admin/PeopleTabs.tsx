import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatKsh } from "@/lib/store-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function useCustomers() {
  return useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_customers");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function CustomersTab() {
  const { data = [], isLoading } = useCustomers();
  const [q, setQ] = useState("");
  const rows = data.filter((c) => `${c.full_name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mt-4">
      <Input placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground"><tr>
            <th className="p-3">Customer</th><th className="p-3">Phone</th><th className="p-3">Area</th>
            <th className="p-3">Orders</th><th className="p-3">Spent</th><th className="p-3">Joined</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3"><div className="font-medium">{c.full_name || "—"} {c.is_admin ? <Badge variant="secondary">Staff</Badge> : null}</div><div className="text-xs text-muted-foreground">{c.email}</div></td>
                <td className="p-3">{c.phone || "—"}</td><td className="p-3">{c.location || "—"}</td>
                <td className="p-3">{c.order_count}</td><td className="p-3">{formatKsh(c.total_spent)}</td>
                <td className="p-3">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{isLoading ? "Loading…" : "No customers yet."}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffTab() {
  const qc = useQueryClient();
  const { data = [] } = useCustomers();
  const [email, setEmail] = useState("");
  const set = async (e: string, make: boolean) => {
    const { error } = await supabase.rpc("admin_set_staff", { _email: e, _make_admin: make });
    if (error) { toast.error(error.message); return; }
    toast.success(make ? "Staff access given" : "Staff access removed");
    setEmail(""); qc.invalidateQueries({ queryKey: ["admin-customers"] });
  };
  const staff = data.filter((c) => c.is_admin);
  return (
    <div className="mt-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">Staff can manage products, orders, adverts and customers. The person must sign up first.</p>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (email.trim()) void set(email, true); }}>
        <Input type="email" placeholder="staff@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit">Add staff</Button>
      </form>
      <ul className="surface-panel mt-4 divide-y divide-border">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center justify-between p-3 text-sm">
            <span><span className="font-medium">{s.full_name || s.email}</span> <span className="text-muted-foreground">{s.email}</span></span>
            <Button size="sm" variant="outline" onClick={() => s.email && void set(s.email, false)}>Remove</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TestimonialsTab() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => (await supabase.from("testimonials").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-testimonials"] }); qc.invalidateQueries({ queryKey: ["testimonials"] }); };
  return (
    <div className="mt-4 space-y-3">
      {data.map((t) => (
        <div key={t.id} className="surface-panel p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{t.name}{t.location ? `, ${t.location}` : ""} · {t.rating}★</span>
            {t.approved ? <Badge>Live</Badge> : <Badge variant="secondary">Waiting</Badge>}
          </div>
          <p className="mt-2">{t.message}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={async () => { await supabase.from("testimonials").update({ approved: !t.approved }).eq("id", t.id); refresh(); }}>
              {t.approved ? "Hide" : "Approve"}
            </Button>
            <Button size="sm" variant="outline" onClick={async () => { await supabase.from("testimonials").delete().eq("id", t.id); refresh(); }}>Delete</Button>
          </div>
        </div>
      ))}
      {!data.length ? <p className="text-sm text-muted-foreground">No testimonials yet.</p> : null}
    </div>
  );
}

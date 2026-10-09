import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PAGE_SIZE = 25;

type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  role_granted: "Role granted",
  role_revoked: "Role revoked",
  product_created: "Product created",
  product_updated: "Product updated",
  product_deleted: "Product deleted",
  inventory_adjusted: "Inventory adjusted",
  order_status_changed: "Order status changed",
  rider_assigned: "Rider assigned",
  payment_verified: "Payment verified",
  payment_rejected: "Payment rejected",
  return_requested: "Return requested",
  return_approved: "Return approved",
  return_rejected: "Return rejected",
  return_refunded: "Refund completed",
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

function ChangeSummary({ row }: { row: AuditRow }) {
  const before = row.before ?? {};
  const after = row.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
  if (keys.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs">
      {keys.slice(0, 3).map((k) => (
        <span key={k} className="mr-2 inline-block">
          <span className="text-muted-foreground">{k}:</span> {String(before[k] ?? "—")} →{" "}
          {String(after[k] ?? "—")}
        </span>
      ))}
      {keys.length > 3 ? <span className="text-muted-foreground">+{keys.length - 3} more</span> : null}
    </span>
  );
}

export function AuditTab() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-audit", page, search, actionFilter, from, to],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (search.trim()) {
        const term = `%${search.trim().replaceAll("%", "").replaceAll(",", " ")}%`;
        q = q.or(`action.ilike.${term},entity_type.ilike.${term},entity_id.ilike.${term}`);
      }
      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) q = q.lte("created_at", new Date(`${to}T23:59:59`).toISOString());
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search action, resource or ID"
            className="w-64 pl-8"
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => {
            setActionFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(0);
          }}
          className="w-40"
          aria-label="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(0);
          }}
          className="w-40"
          aria-label="To date"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="surface-panel p-6 text-center text-sm text-muted-foreground">
          Could not load the audit log
          {error instanceof Error && error.message.includes("audit_logs")
            ? " — the audit-log database migration has not been applied yet."
            : "."}
        </div>
      ) : rows.length === 0 ? (
        <div className="surface-panel p-6 text-center text-sm text-muted-foreground">
          No audit events match these filters yet. Staff actions such as payment verification,
          refunds and product changes will appear here.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="surface-panel block w-full p-3 text-left transition-colors hover:bg-accent/50"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{actionLabel(row.action)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {row.entity_type}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ""}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("en-KE")}
                </span>
              </div>
              <div className="mt-1">
                <ChangeSummary row={row} />
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {page + 1} of {totalPages} · {data?.count ?? 0} events
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="size-4" /> Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Older <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? actionLabel(selected.action) : ""}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">When</dt>
                <dd className="col-span-2">{new Date(selected.created_at).toLocaleString("en-KE")}</dd>
                <dt className="text-muted-foreground">Actor</dt>
                <dd className="col-span-2">
                  {selected.actor_id ? `${selected.actor_id.slice(0, 8)}…` : "System"}
                  {selected.actor_role ? ` (${selected.actor_role})` : ""}
                </dd>
                <dt className="text-muted-foreground">Resource</dt>
                <dd className="col-span-2">
                  {selected.entity_type} {selected.entity_id ?? ""}
                </dd>
              </dl>
              {selected.before ? (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Before</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(selected.before, null, 2)}
                  </pre>
                </div>
              ) : null}
              {selected.after ? (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">After</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(selected.after, null, 2)}
                  </pre>
                </div>
              ) : null}
              {selected.metadata && Object.keys(selected.metadata).length > 0 ? (
                <div>
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Details</p>
                  <pre className="max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

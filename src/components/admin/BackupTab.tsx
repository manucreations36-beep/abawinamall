import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type TableName = "orders" | "order_items" | "products" | "profiles" | "reviews" | "testimonials";

const TABLES: { id: TableName; label: string }[] = [
  { id: "orders", label: "Orders" },
  { id: "order_items", label: "Order items" },
  { id: "products", label: "Products" },
  { id: "profiles", label: "Customers" },
  { id: "reviews", label: "Reviews" },
  { id: "testimonials", label: "Testimonials" },
];

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BackupTab() {
  const [busy, setBusy] = useState<string | null>(null);

  const exportTable = async (table: TableName, format: "csv" | "json") => {
    setBusy(`${table}-${format}`);
    const { data, error } = await supabase.from(table).select("*").limit(10000);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      download(`abawina-${table}-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
    } else {
      download(`abawina-${table}-${stamp}.csv`, toCsv(rows), "text/csv");
    }
    toast.success(`${rows.length} ${table} rows downloaded`);
  };

  return (
    <div className="mt-4 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Download a backup copy of your shop data. Files save to your device.
      </p>
      <div className="surface-panel mt-4 divide-y divide-border">
        {TABLES.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 p-3 text-sm">
            <span className="font-medium">{t.label}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void exportTable(t.id, "csv")}
              >
                <Download className="mr-1 size-3.5" />
                {busy === `${t.id}-csv` ? "…" : "CSV"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void exportTable(t.id, "json")}
              >
                <Download className="mr-1 size-3.5" />
                {busy === `${t.id}-json` ? "…" : "JSON"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

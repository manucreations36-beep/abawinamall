import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tables included in the backup. Edit this list to add or remove tables.
 * A table that doesn't exist, or that you have no permission to read,
 * is skipped and reported instead of breaking the whole backup.
 */
const TABLES = [
  "categories",
  "products",
  "campaigns",
  "orders",
  "order_items",
  "profiles",
  "riders",
  "testimonials",
] as const;

const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;
type QueryResult = PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
// The generated Supabase types only allow known table names, so use a loose view for dynamic names.
type LooseClient = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string) => { range: (from: number, to: number) => QueryResult };
    };
  };
};

async function fetchTable(table: string): Promise<Row[]> {
  const client = supabase as unknown as LooseClient;
  const all: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
  ].join("\r\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

export function BackupTab() {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<{
    at: string;
    counts: Record<string, number>;
    skipped: Record<string, string>;
  } | null>(null);

  const runFullBackup = async () => {
    setBusy("full");
    try {
      const tables: Record<string, Row[]> = {};
      const counts: Record<string, number> = {};
      const skipped: Record<string, string> = {};

      for (const table of TABLES) {
        try {
          const rows = await fetchTable(table);
          tables[table] = rows;
          counts[table] = rows.length;
        } catch (error: unknown) {
          skipped[table] = error instanceof Error ? error.message : "Could not read this table";
        }
      }

      if (Object.keys(tables).length === 0) {
        toast.error("Backup failed: none of the tables could be read.");
        setLastRun({ at: new Date().toLocaleString("en-KE"), counts, skipped });
        return;
      }

      const payload = {
        app: "ABAWINA MALL",
        created_at: new Date().toISOString(),
        tables,
        skipped,
      };
      download(`abawina-backup-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
      setLastRun({ at: new Date().toLocaleString("en-KE"), counts, skipped });

      const skippedCount = Object.keys(skipped).length;
      toast.success(
        skippedCount
          ? `Backup downloaded. ${skippedCount} table(s) were skipped.`
          : "Backup downloaded.",
      );
    } catch (error: unknown) {
      console.error("Backup failed:", error);
      toast.error(`Backup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  };

  const runTableCsv = async (table: string) => {
    setBusy(table);
    try {
      const rows = await fetchTable(table);
      if (rows.length === 0) {
        toast.info(`${table} has no rows to export.`);
        return;
      }
      download(`${table}-${today()}.csv`, `\uFEFF${toCsv(rows)}`, "text/csv;charset=utf-8");
      toast.success(`${table} exported (${rows.length} rows).`);
    } catch (error: unknown) {
      console.error(`Export of ${table} failed:`, error);
      toast.error(`Could not export ${table}: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 space-y-6">
      <div className="surface-panel p-5">
        <h3 className="font-semibold">Full backup</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Downloads one JSON file with your products, categories, orders, adverts and customer
          profiles. Product photos are not inside the file — it only keeps their web addresses, and
          the photos stay in Supabase Storage.
        </p>
        <Button className="mt-4" disabled={busy !== null} onClick={() => void runFullBackup()}>
          {busy === "full" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {busy === "full" ? "Preparing backup…" : "Download full backup"}
        </Button>

        {lastRun ? (
          <div className="mt-4 text-sm">
            <p className="text-muted-foreground">Last backup: {lastRun.at}</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {Object.entries(lastRun.counts).map(([table, count]) => (
                <li key={table} className="flex justify-between gap-3">
                  <span>{table}</span>
                  <span className="text-muted-foreground">{count} rows</span>
                </li>
              ))}
            </ul>
            {Object.keys(lastRun.skipped).length > 0 ? (
              <div className="mt-3 rounded-md border border-input p-3">
                <p className="font-medium">Skipped tables</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {Object.entries(lastRun.skipped).map(([table, reason]) => (
                    <li key={table}>
                      {table}: {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="surface-panel p-5">
        <h3 className="font-semibold">Export one table (CSV)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Opens in Excel or Google Sheets.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABLES.map((table) => (
            <Button
              key={table}
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void runTableCsv(table)}
            >
              {busy === table ? <Loader2 className="size-4 animate-spin" /> : null}
              {table}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

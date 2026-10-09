import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ORDER_STATUSES, formatKsh } from "@/lib/store-config";
import { CustomersTab, StaffTab, TestimonialsTab } from "@/components/admin/PeopleTabs";
import { ReturnsTab, RidersTab, SmsTab, useRiders } from "@/components/admin/DeliveryTabs";
import { AuditTab } from "@/components/admin/AuditTab";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Store dashboard | ABAWINA MALL" },
      { name: "description", content: "Private ABAWINA MALL store management dashboard." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Store dashboard | ABAWINA MALL" },
      { property: "og:description", content: "Private store management dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});
const createUploadId = (): string => {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));

      return Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("");
    }
  }

  // Fallback for older or restricted environments
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

async function uploadImage(file: File) {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `products/${createUploadId()}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-xl font-bold">Staff only</h1>
        <p className="text-sm text-muted-foreground">
          {user
            ? `${user.email} doesn't have dashboard access.`
            : "Sign in with your staff account to open the dashboard."}
        </p>
        <Button onClick={() => void navigate({ to: user ? "/" : "/auth" })}>
          {user ? "Back to shop" : "Sign in"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="font-display text-2xl font-bold">Store dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Products, orders, adverts and performance — visible to staff only.
      </p>

      <Tabs defaultValue="analytics" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="riders">Riders</TabsTrigger>
          <TabsTrigger value="sms">Text messages</TabsTrigger>
          <TabsTrigger value="ads">Adverts</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="returns"><ReturnsTab /></TabsContent>
        <TabsContent value="riders"><RidersTab /></TabsContent>
        <TabsContent value="sms"><SmsTab /></TabsContent>
        <TabsContent value="ads">
          <AdsTab />
        </TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="testimonials"><TestimonialsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Analytics ---------------- */

const RANGES = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
];

function AnalyticsTab() {
  const [range, setRange] = useState("30");
  const since = useMemo(
    () => new Date(Date.now() - Number(range) * 86400000).toISOString(),
    [range],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", range],
    queryFn: async () => {
      const [orders, items, events, lowStock, customers] = await Promise.all([
        supabase.from("orders").select("id, total, status, created_at").gte("created_at", since),
        supabase
          .from("order_items")
          .select("product_name, quantity, unit_price, order_id, orders!inner(created_at)")
          .gte("orders.created_at", since),
        supabase.from("page_events").select("event_type, created_at").gte("created_at", since),
        supabase
          .from("products")
          .select("id, name, stock_count, in_stock")
          .lte("stock_count", 3)
          .order("stock_count"),
        supabase.from("profiles").select("id").gte("created_at", since),
      ]);
      return {
        orders: orders.data ?? [],
        items: items.data ?? [],
        events: events.data ?? [],
        lowStock: lowStock.data ?? [],
        customers: customers.data?.length ?? 0,
      };
    },
  });

  if (isLoading || !data) {
    return <div className="py-16 text-center text-muted-foreground">Loading numbers…</div>;
  }

  const paid = data.orders.filter((o) => o.status !== "cancelled");
  const revenue = paid.reduce((n, o) => n + Number(o.total), 0);
  const aov = paid.length ? revenue / paid.length : 0;
  const views = data.events.filter((e) => e.event_type === "product_view").length;
  const conversion = views ? (paid.length / views) * 100 : 0;

  const byDay = new Map<string, number>();
  paid.forEach((o) => {
    const key = new Date(o.created_at).toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + Number(o.total));
  });
  const revenueSeries = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day: day.slice(5), total }));

  const byProduct = new Map<string, number>();
  data.items.forEach((i) => {
    byProduct.set(
      i.product_name,
      (byProduct.get(i.product_name) ?? 0) + Number(i.unit_price) * i.quantity,
    );
  });
  const topProducts = [...byProduct.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, total]) => ({ name: name.slice(0, 18), total }));

  return (
    <div className="mt-4 space-y-6">
      <div className="w-56">
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Revenue" value={formatKsh(revenue)} />
        <Stat label="Orders" value={String(paid.length)} />
        <Stat label="Average order" value={formatKsh(aov)} />
        <Stat label="Product views" value={String(views)} />
        <Stat label="New customers" value={String(data.customers)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-panel p-5">
          <h3 className="font-semibold">Revenue per day</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueSeries}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatKsh(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-panel p-5">
          <h3 className="font-semibold">Top products by sales</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="name" fontSize={10} interval={0} angle={-20} height={50} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => formatKsh(Number(v))} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-panel p-5">
          <h3 className="font-semibold">Views to orders</h3>
          <p className="mt-2 text-3xl font-bold text-primary">{conversion.toFixed(1)}%</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {paid.length} orders from {views} product views.
          </p>
        </div>
        <div className="surface-panel p-5">
          <h3 className="font-semibold">Low stock alerts</h3>
          {data.lowStock.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">All products are well stocked.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.lowStock.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span>{p.name}</span>
                  <Badge variant={p.stock_count === 0 ? "destructive" : "secondary"}>
                    {p.stock_count} left
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

/* ---------------- Products ---------------- */

type ProductForm = {
  id?: string;
  sku: string;
  name: string;
  category_id: string;
  price: string;
  original_price: string;
  flash_price: string;
  flash_ends_at: string;
  stock_count: string;
  brand: string;
  badge: string;
  warranty: string;
  description: string;
  image_url: string;
  is_featured: boolean;
  is_deal: boolean;
  is_published: boolean;
};

const emptyForm: ProductForm = {
  sku: "",
  name: "",
  category_id: "",
  price: "",
  original_price: "",
  flash_price: "",
  flash_ends_at: "",
  stock_count: "0",
  brand: "",
  badge: "",
  warranty: "",
  description: "",
  image_url: "",
  is_featured: false,
  is_deal: false,
  is_published: true,
};

function ProductsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("sort_order");
      return data ?? [];
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, sku, name, price, original_price, flash_price, flash_ends_at, stock_count, image_url, badge, brand, warranty, description, category_id, is_featured, is_deal, is_published",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (input: ProductForm) => {
      const payload = {
        sku: input.sku || null,
        name: input.name,
        category_id: input.category_id || null,
        price: Number(input.price || 0),
        original_price: input.original_price ? Number(input.original_price) : null,
        flash_price: input.flash_price ? Number(input.flash_price) : null,
        flash_ends_at: input.flash_ends_at ? new Date(input.flash_ends_at).toISOString() : null,
        stock_count: Number(input.stock_count || 0),
        in_stock: Number(input.stock_count || 0) > 0,
        brand: input.brand || null,
        badge: input.badge || null,
        warranty: input.warranty || null,
        description: input.description || null,
        image_url: input.image_url || null,
        is_featured: input.is_featured,
        is_deal: input.is_deal,
        is_published: input.is_published,
        updated_at: new Date().toISOString(),
      };
      const { error } = input.id
        ? await supabase.from("products").update(payload).eq("id", input.id)
        : await supabase.from("products").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product saved.");
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: () => toast.error("Could not save the product."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted.");
      void queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: () => toast.error("Could not delete the product."),
  });

  const togglePublished = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("products").update({ is_published: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Image uploaded.");
    }     catch (error: unknown) {
      console.error("Product image upload failed:", error);

      const message =
        error instanceof Error ? error.message : "Unknown storage error";

      toast.error(`Image upload failed: ${message}`);
    } finally {
      setUploading(false);
    }
  };

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{products.length} products</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(emptyForm)}>
              <Plus className="size-4" /> New product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit product" : "New product"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
                </div>
                <div>
                  <Label>Code / SKU</Label>
                  <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Brand</Label>
                  <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
                </div>
                <div>
                  <Label>Price (KSh)</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => set("price", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Was price (KSh)</Label>
                  <Input
                    type="number"
                    value={form.original_price}
                    onChange={(e) => set("original_price", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Flash deal price (KSh)</Label>
                  <Input
                    type="number"
                    value={form.flash_price}
                    onChange={(e) => set("flash_price", e.target.value)}
                    placeholder="Leave empty for no flash deal"
                  />
                </div>
                <div>
                  <Label>Flash deal ends</Label>
                  <Input
                    type="datetime-local"
                    value={form.flash_ends_at}
                    onChange={(e) => set("flash_ends_at", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    value={form.stock_count}
                    onChange={(e) => set("stock_count", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Badge</Label>
                  <Input value={form.badge} onChange={(e) => set("badge", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Warranty</Label>
                  <Input value={form.warranty} onChange={(e) => set("warranty", e.target.value)} />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>

              <div>
                <Label>Product photo</Label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="size-20 overflow-hidden rounded-xl bg-secondary">
                    {form.image_url ? (
                      <img loading="lazy" decoding="async" src={form.image_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {uploading ? "Uploading…" : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void pickImage(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <ToggleField
                  label="Featured"
                  checked={form.is_featured}
                  onChange={(v) => set("is_featured", v)}
                />
                <ToggleField
                  label="On deal"
                  checked={form.is_deal}
                  onChange={(v) => set("is_deal", v)}
                />
                <ToggleField
                  label="Visible in shop"
                  checked={form.is_published}
                  onChange={(v) => set("is_published", v)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save product"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading products…</div>
      ) : (
        <div className="mt-4 space-y-2">
          {products.map((p) => (
            <div key={p.id} className="surface-panel flex flex-wrap items-center gap-4 p-3">
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {p.image_url ? (
                  <img loading="lazy" decoding="async" src={p.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-40 flex-1">
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.sku ?? "no code"} · {formatKsh(p.price)} · {p.stock_count} in stock
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Visible</span>
                <Switch
                  checked={p.is_published}
                  onCheckedChange={(v) => togglePublished.mutate({ id: p.id, value: v })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({
                    id: p.id,
                    sku: p.sku ?? "",
                    name: p.name,
                    category_id: p.category_id ?? "",
                    price: String(p.price),
                    original_price: p.original_price ? String(p.original_price) : "",
                    flash_price: p.flash_price ? String(p.flash_price) : "",
                    flash_ends_at: p.flash_ends_at
                      ? new Date(new Date(p.flash_ends_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                      : "",
                    stock_count: String(p.stock_count),
                    brand: p.brand ?? "",
                    badge: p.badge ?? "",
                    warranty: p.warranty ?? "",
                    description: p.description ?? "",
                    image_url: p.image_url ?? "",
                    is_featured: p.is_featured,
                    is_deal: p.is_deal,
                    is_published: p.is_published,
                  });
                  setOpen(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Delete product"
                onClick={() => remove.mutate(p.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* ---------------- Orders ---------------- */

function OrdersTab() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_no, status, payment_status, total, rider_id, customer_name, customer_phone, delivery_zone, delivery_address, payment_method, mpesa_code, created_at, order_items(product_name, quantity, unit_price)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: riders = [] } = useRiders();

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated. The customer will be texted.");
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: () => toast.error("Could not update the order."),
  });

  const setRider = useMutation({
    mutationFn: async ({ id, rider_id }: { id: string; rider_id: string | null }) => {
      const { error } = await supabase.from("orders").update({ rider_id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rider assigned.");
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: () => toast.error("Could not assign the rider."),
  });

  const verifyPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("verify_payment", { _order_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment verified. The customer will be texted.");
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not verify the payment."),
  });

  const rejectPayment = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("reject_payment", { _order_id: id, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment rejected. The customer will be texted.");
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reject the payment."),
  });

  if (isLoading) {
    return <div className="py-16 text-center text-muted-foreground">Loading orders…</div>;
  }

  if (orders.length === 0) {
    return <div className="py-16 text-center text-muted-foreground">No orders yet.</div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="surface-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">
                {order.order_no} · {formatKsh(order.total)}{" "}
                <Badge
                  variant={
                    order.payment_status === "paid"
                      ? "default"
                      : order.payment_status === "awaiting_verification"
                        ? "secondary"
                        : order.payment_status === "failed"
                          ? "destructive"
                          : "outline"
                  }
                  className="ml-1 align-middle"
                >
                  {order.payment_status === "awaiting_verification"
                    ? "awaiting verification"
                    : order.payment_status === "partially_refunded"
                      ? "partially refunded"
                      : order.payment_status}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {order.customer_name} · {order.customer_phone} · {order.delivery_zone} ·{" "}
                {order.payment_method}{order.mpesa_code ? ` (${order.mpesa_code})` : ""} · {new Date(order.created_at).toLocaleString("en-KE")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {order.payment_status === "awaiting_verification" ? (
                <>
                  <Button
                    size="sm"
                    disabled={verifyPayment.isPending}
                    onClick={() => verifyPayment.mutate(order.id)}
                  >
                    Verify payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rejectPayment.isPending}
                    onClick={() => {
                      const reason = window.prompt("Reason for rejecting this payment:");
                      if (reason && reason.trim().length >= 3) {
                        rejectPayment.mutate({ id: order.id, reason: reason.trim() });
                      } else if (reason !== null) {
                        toast.error("Give a short reason for rejecting the payment.");
                      }
                    }}
                  >
                    Reject
                  </Button>
                </>
              ) : null}
              <Select
                value={order.rider_id ?? "none"}
                onValueChange={(v) => setRider.mutate({ id: order.id, rider_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Rider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rider</SelectItem>
                  {riders.filter((r) => r.active || r.id === order.rider_id).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={order.status}
                onValueChange={(status) => setStatus.mutate({ id: order.id, status })}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
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
          {order.delivery_address ? (
            <p className="mt-2 text-xs text-muted-foreground">{order.delivery_address}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Adverts ---------------- */

type CampaignForm = {
  id?: string;
  title: string;
  headline: string;
  description: string;
  discount_label: string;
  discount_percent: string;
  category_id: string;
  cta_text: string;
  budget_kes: string;
  image_url: string;
  ends_at: string;
};

const emptyCampaign: CampaignForm = {
  title: "",
  headline: "",
  description: "",
  discount_label: "",
  discount_percent: "",
  category_id: "",
  cta_text: "Shop now",
  budget_kes: "0",
  image_url: "",
  ends_at: "",
};

function AdsTab() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CampaignForm>(emptyCampaign);
  const [uploading, setUploading] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("sort_order");
      return data ?? [];
    },
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (input: CampaignForm) => {
      const payload = {
        title: input.title,
        headline: input.headline || null,
        description: input.description || null,
        discount_label: input.discount_label || null,
        discount_percent: input.discount_percent ? Number(input.discount_percent) : null,
        category_id: input.category_id || null,
        cta_text: input.cta_text || "Shop now",
        budget_kes: Number(input.budget_kes || 0),
        image_url: input.image_url || null,
        ...(input.ends_at ? { ends_at: new Date(input.ends_at).toISOString() } : {}),
      };
      const { error } = input.id
        ? await supabase.from("campaigns").update(payload).eq("id", input.id)
        : await supabase.from("campaigns").insert({ ...payload, status: "live" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Advert saved.");
      setOpen(false);
      setForm(emptyCampaign);
      void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: () => toast.error("Could not save the advert."),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, live }: { id: string; live: boolean }) => {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: live ? "live" : "paused" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Advert removed.");
      void queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
  });

  const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      set("image_url", await uploadImage(file));
      toast.success("Banner uploaded.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{campaigns.length} adverts</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setForm(emptyCampaign)}>
              <Plus className="size-4" /> New advert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit advert" : "New advert"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
                </div>
                <div>
                  <Label>Headline on banner</Label>
                  <Input value={form.headline} onChange={(e) => set("headline", e.target.value)} />
                </div>
                <div>
                  <Label>Offer label</Label>
                  <Input
                    placeholder="Up to 30% off"
                    value={form.discount_label}
                    onChange={(e) => set("discount_label", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    value={form.discount_percent}
                    onChange={(e) => set("discount_percent", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Target category</Label>
                  <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Budget (KSh)</Label>
                  <Input
                    type="number"
                    value={form.budget_kes}
                    onChange={(e) => set("budget_kes", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Button text</Label>
                  <Input value={form.cta_text} onChange={(e) => set("cta_text", e.target.value)} />
                </div>
                <div>
                  <Label>Ends on</Label>
                  <Input
                    type="date"
                    value={form.ends_at}
                    onChange={(e) => set("ends_at", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
              <div>
                <Label>Banner image</Label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-16 w-28 overflow-hidden rounded-xl bg-secondary">
                    {form.image_url ? (
                      <img loading="lazy" decoding="async" src={form.image_url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                    {uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {uploading ? "Uploading…" : "Upload banner"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void pickImage(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={save.isPending}>
                {save.isPending ? "Saving…" : "Save advert"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">Loading adverts…</div>
      ) : (
        <div className="mt-4 space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="surface-panel flex flex-wrap items-center gap-4 p-3">
              <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {c.image_url ? (
                  <img loading="lazy" decoding="async" src={c.image_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-40 flex-1">
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.views} views · {c.clicks} clicks · {c.conversions} orders · budget{" "}
                  {formatKsh(c.budget_kes)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {c.status === "live" ? "Live" : "Paused"}
                </span>
                <Switch
                  checked={c.status === "live"}
                  onCheckedChange={(live) => toggleStatus.mutate({ id: c.id, live })}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({
                    id: c.id,
                    title: c.title,
                    headline: c.headline ?? "",
                    description: c.description ?? "",
                    discount_label: c.discount_label ?? "",
                    discount_percent: c.discount_percent ? String(c.discount_percent) : "",
                    category_id: c.category_id ?? "",
                    cta_text: c.cta_text ?? "Shop now",
                    budget_kes: String(c.budget_kes),
                    image_url: c.image_url ?? "",
                    ends_at: c.ends_at ? c.ends_at.slice(0, 10) : "",
                  });
                  setOpen(true);
                }}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                aria-label="Delete advert"
                onClick={() => remove.mutate(c.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

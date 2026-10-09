import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My account | ABAWINA MALL" },
      {
        name: "description",
        content: "Update your name, phone and delivery area for faster ABAWINA MALL checkout.",
      },
      { property: "og:title", content: "My account | ABAWINA MALL" },
      { property: "og:description", content: "Manage your ABAWINA MALL delivery details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("profiles")
      .select("full_name, phone, location")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setLocation(data.location ?? "");
      });
    return () => {
      active = false;
    };
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone, location })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error("Could not save your details.");
    else toast.success("Details saved.");
  };

  if (!user) return <div className="px-4 py-20 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-2xl font-bold">My account</h1>
      <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
      <form onSubmit={save} className="surface-panel mt-6 space-y-4 p-5">
        <div>
          <Label htmlFor="ac-name">Full name</Label>
          <Input id="ac-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ac-phone">Phone</Label>
          <Input id="ac-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="ac-loc">Estate / area</Label>
          <Input id="ac-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save details"}
        </Button>
      </form>
      <Button variant="outline" className="mt-4 w-full" asChild>
        <Link to="/orders">My orders</Link>
      </Button>
    </div>
  );
}

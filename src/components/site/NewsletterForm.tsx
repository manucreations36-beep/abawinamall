import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().trim().email().max(255);

export async function subscribeEmail(raw: string, source: string) {
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Please enter a valid email." };
  const { error } = await supabase
    .from("newsletter_subscribers")
    .insert({ email: parsed.data.toLowerCase(), source });
  if (error && error.code !== "23505") return { ok: false, message: "Could not subscribe. Try again." };
  return { ok: true, message: "You're subscribed! Watch your inbox for deals." };
}

export function NewsletterForm({ source = "footer", onDone }: { source?: string; onDone?: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await subscribeEmail(email, source);
        setBusy(false);
        if (r.ok) {
          toast.success(r.message);
          setEmail("");
          onDone?.();
        } else toast.error(r.message);
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "…" : "Subscribe"}
      </button>
    </form>
  );
}

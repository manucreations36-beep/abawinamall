import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { STORE, whatsappLink } from "@/lib/store-config";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact ABAWINA MALL | Mombasa" },
      { name: "description", content: "Call, WhatsApp or message ABAWINA MALL in Nyali and Mombasa CBD." },
      { property: "og:title", content: "Contact ABAWINA MALL" },
      { property: "og:description", content: "Questions about a product or order? Send us a message." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z.string().trim().min(9, "Enter a valid phone").max(20),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(2, "Write a message").max(2000),
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-2">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Get in touch</h1>
        <p className="mt-2 text-muted-foreground">We usually reply within a few hours during business days.</p>
        <ul className="mt-6 space-y-3 text-sm">
          <li className="flex gap-2"><MapPin className="size-4 shrink-0" /> {STORE.address}</li>
          <li><a href={`tel:${STORE.phone}`} className="flex gap-2 hover:text-primary"><Phone className="size-4" /> {STORE.phoneDisplay}</a></li>
          <li><a href={`mailto:${STORE.email}`} className="flex gap-2 hover:text-primary"><Mail className="size-4" /> {STORE.email}</a></li>
        </ul>
        <a href={whatsappLink("Hello ABAWINA MALL, I have a question.")} target="_blank" rel="noreferrer"
          className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Chat on WhatsApp
        </a>
      </div>
      <form
        className="space-y-3 rounded-xl border border-border bg-surface p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = schema.safeParse(form);
          if (!p.success) { toast.error(p.error.issues[0]?.message ?? "Check the form"); return; }
          setBusy(true);
          const { error } = await supabase.from("inquiries").insert({
            name: p.data.name, phone: p.data.phone, email: p.data.email || null,
            subject: p.data.subject || null, message: p.data.message,
          });
          setBusy(false);
          if (error) { toast.error("Could not send. Please try again."); return; }
          toast.success("Message sent — we'll get back to you soon.");
          setForm({ name: "", phone: "", email: "", subject: "", message: "" });
        }}
      >
        <input className={input} placeholder="Your name *" value={form.name} onChange={set("name")} />
        <input className={input} placeholder="Phone *" value={form.phone} onChange={set("phone")} />
        <input className={input} placeholder="Email" type="email" value={form.email} onChange={set("email")} />
        <input className={input} placeholder="Subject" value={form.subject} onChange={set("subject")} />
        <textarea className={input} rows={5} placeholder="Message *" value={form.message} onChange={set("message")} />
        <button disabled={busy} className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}

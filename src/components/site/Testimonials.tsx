import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Quote, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function Testimonials({ showForm = false }: { showForm?: boolean }) {
  const { data = [] } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const { data } = await supabase.from("testimonials").select("id,name,location,rating,message")
        .eq("approved", true).order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });
  if (!data.length && !showForm) return null;
  return (
    <section className="mt-14">
      <h2 className="font-display text-xl font-bold">What our customers say</h2>
      {data.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <figure key={t.id} className="surface-panel p-5">
              <Quote className="size-5 text-primary" />
              <div className="mt-2 flex">{Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`size-4 ${i < t.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              ))}</div>
              <blockquote className="mt-2 text-sm">{t.message}</blockquote>
              <figcaption className="mt-3 text-xs text-muted-foreground">— {t.name}{t.location ? `, ${t.location}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-muted-foreground">Be the first to share your experience.</p>}
      {showForm ? <TestimonialForm /> : null}
    </section>
  );
}

function TestimonialForm() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return <p className="mt-6 text-sm"><Link to="/auth" className="text-primary underline">Sign in</Link> to share your experience.</p>;
  return (
    <form className="surface-panel mt-6 grid gap-3 p-5" onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim() || message.trim().length < 5) { toast.error("Add your name and a short message"); return; }
      setBusy(true);
      const { error } = await supabase.from("testimonials").insert({ user_id: user.id, name: name.trim(), location: location.trim() || null, rating, message: message.trim() });
      setBusy(false);
      if (error) { toast.error("Could not send. Try again."); return; }
      toast.success("Thank you! It will appear once approved.");
      setMessage(""); qc.invalidateQueries({ queryKey: ["testimonials"] });
    }}>
      <h3 className="font-semibold">Share your experience</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <Input placeholder="Area (e.g. Nyali)" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} />
      </div>
      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
          <Star className={`size-5 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}</div>
      <Textarea placeholder="How was your shopping with us?" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
      <Button type="submit" disabled={busy} className="justify-self-start">Submit</Button>
    </form>
  );
}

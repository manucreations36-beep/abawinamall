import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(size, i <= value ? "fill-accent text-accent" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data: reviews = [] } = useQuery({
    queryKey: ["public-reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_reviews")
        .select("id, product_id, author_name, rating, comment, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-review", productId, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("reviews")
        .select("id, product_id, user_id, author_name, rating, comment, created_at")
        .eq("product_id", productId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

 

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      if (rating < 1) throw new Error("Pick a star rating");
      const author =
        (user.user_metadata?.["full_name"] as string | undefined)?.trim() ||
        user.email?.split("@")[0] ||
        "Customer";
      const { error } = await supabase.from("reviews").upsert(
        { product_id: productId, user_id: user.id, author_name: author, rating, comment: comment.trim() || null },
        { onConflict: "product_id,user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks for your review");
      setComment("");
      setRating(0);
     void qc.invalidateQueries({
  queryKey: ["public-reviews", productId],
});

void qc.invalidateQueries({
  queryKey: ["my-review", productId, user?.id],
});
      void qc.invalidateQueries({ queryKey: ["product"] });
      void router.invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't save review"),
  });

  const counts = [5, 4, 3, 2, 1].map((s) => reviews.filter((r) => r.rating === s).length);
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  return (
    <section className="mt-14" id="reviews">
      <h2 className="font-display text-xl font-bold">Customer reviews</h2>
      <div className="mt-5 grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="surface-panel p-4">
          <p className="font-display text-4xl font-extrabold">{avg.toFixed(1)}</p>
          <Stars value={Math.round(avg)} />
          <p className="mt-1 text-xs text-muted-foreground">{reviews.length} reviews</p>
          <div className="mt-4 space-y-1.5">
            {counts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-3">{5 - i}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-accent" style={{ width: `${reviews.length ? (c / reviews.length) * 100 : 0}%` }} />
                </div>
                <span className="w-5 text-right text-muted-foreground">{c}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {user ? (
            <form
              className="surface-panel space-y-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit.mutate();
              }}
            >
              <p className="text-sm font-medium">{mine ? "Update your review" : "Write a review"}</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button type="button" key={i} aria-label={`${i} stars`} onClick={() => setRating(i)}>
                    <Star className={cn("size-6", i <= rating ? "fill-accent text-accent" : "text-muted-foreground/40")} />
                  </button>
                ))}
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                placeholder="What did you like or dislike?"
              />
              <Button type="submit" disabled={submit.isPending}>
                {submit.isPending ? "Saving…" : "Post review"}
              </Button>
            </form>
          ) : (
            <p className="surface-panel p-4 text-sm">
              <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link> to write a review.
            </p>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Be the first.</p>
          ) : (
            reviews.map((r) => (
              <article key={r.id} className="border-b border-border pb-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{r.author_name}</span>
                  <time className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-KE")}
                  </time>
                </div>
                <Stars value={r.rating} size="size-3.5" />
                {r.comment ? <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p> : null}
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

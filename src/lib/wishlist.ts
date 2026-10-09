import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useWishlistIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["wishlist-ids", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("wishlists").select("product_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.product_id));
    },
  });
}

export function useToggleWishlist() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, saved }: { productId: string; saved: boolean }) => {
      if (!user) throw new Error("signin");
      if (saved) {
        const { error } = await supabase.from("wishlists").delete().eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wishlists")
          .insert({ product_id: productId, user_id: user.id });
        if (error) throw error;
      }
      return !saved;
    },
    onSuccess: (nowSaved) => {
      toast.success(nowSaved ? "Saved to wishlist" : "Removed from wishlist");
      void qc.invalidateQueries({ queryKey: ["wishlist-ids"] });
      void qc.invalidateQueries({ queryKey: ["wishlist"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "signin") toast.error("Sign in to save items");
      else toast.error("Couldn't update your wishlist");
    },
  });
}

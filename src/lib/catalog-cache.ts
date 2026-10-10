import type { QueryClient } from "@tanstack/react-query";

/**
 * Called after the admin changes products, orders or adverts.
 * Refreshes every cached query the storefront uses so shoppers see the change,
 * while leaving the admin dashboard's own queries (keys starting with "admin-")
 * alone, since each admin tab already refreshes itself.
 */
export function refreshCatalog(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const first = query.queryKey[0];
      return !(typeof first === "string" && first.startsWith("admin-"));
    },
  });
}

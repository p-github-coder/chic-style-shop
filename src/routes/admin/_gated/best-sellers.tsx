import { createFileRoute } from "@tanstack/react-router";
import { CollectionManager } from "@/components/admin/CollectionManager";

export const Route = createFileRoute("/admin/_gated/best-sellers")({
  component: () => (
    <CollectionManager
      field="best_seller"
      title="Best Sellers"
      subtitle="Choose which products appear in the homepage Best Sellers row, set their order and rating."
    />
  ),
});

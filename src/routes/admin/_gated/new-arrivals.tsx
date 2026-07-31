import { createFileRoute } from "@tanstack/react-router";
import { CollectionManager } from "@/components/admin/CollectionManager";

export const Route = createFileRoute("/admin/_gated/new-arrivals")({
  component: () => (
    <CollectionManager
      field="new_arrival"
      title="New Arrivals"
      subtitle="Choose which products appear in the homepage New Arrivals row, set their order and rating."
    />
  ),
});

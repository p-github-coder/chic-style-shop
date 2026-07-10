import { createFileRoute } from "@tanstack/react-router";
import { Gallery } from "@/components/Gallery";

export const Route = createFileRoute("/_authenticated/shoes")({
  component: () => <Gallery type="shoes" title="Shoes" subtitle="Sneakers, boots and everything between." />,
});

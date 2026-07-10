import { createFileRoute } from "@tanstack/react-router";
import { Gallery } from "@/components/Gallery";

export const Route = createFileRoute("/_authenticated/bags")({
  component: () => <Gallery type="bags" title="Bags" subtitle="Totes, backpacks, clutches — carry it in style." />,
});

import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Gallery } from "@/components/Gallery";

export const Route = createFileRoute("/bags")({
  ssr: false,
  component: () => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <Gallery type="bags" title="Bags" subtitle="Totes, backpacks, clutches — carry it in style." />
      </main>
    </div>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { Gallery } from "@/components/Gallery";

export const Route = createFileRoute("/shoes")({
  ssr: false,
  component: () => (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <Gallery type="shoes" title="Shoes" subtitle="Sneakers, boots and everything between." />
      </main>
    </div>
  ),
});

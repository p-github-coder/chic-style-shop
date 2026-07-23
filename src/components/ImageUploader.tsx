import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";

type Bucket = "product-images" | "brand-logos";

export function SingleImageUploader({
  bucket,
  value,
  onChange,
  label = "Image",
}: {
  bucket: Bucket;
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setLoading(true);
    try {
      const url = await uploadImage(bucket, f);
      onChange(url);
      toast.success(`${label} uploaded`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-accent flex items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
        <div className="flex-1 space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => ref.current?.click()}
            className="w-full"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
            Upload {label}
          </Button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="text-xs text-muted-foreground hover:text-destructive">
              Remove
            </button>
          )}
        </div>
      </div>
      <Input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL"
        className="text-xs"
      />
    </div>
  );
}

export function MultiImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setLoading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadImage("product-images", f));
      onChange([...value, ...urls]);
      toast.success(`Uploaded ${urls.length} image${urls.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {value.map((u, i) => (
          <div key={u + i} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={loading}
          onClick={() => ref.current?.click()}
          className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-accent"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </button>
      </div>
      <Input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { const fs = e.target.files; if (fs && fs.length) handleFiles(fs); e.currentTarget.value = ""; }}
      />
    </div>
  );
}

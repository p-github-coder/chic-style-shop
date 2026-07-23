import { supabaseAdminClient } from "@/integrations/supabase/admin-client";

// Uploads a file to a Supabase Storage bucket (using the admin session, since
// admin RLS policies restrict writes to admins) and returns a long-lived
// signed URL that can be embedded on the public site.
export async function uploadImage(
  bucket: "product-images" | "brand-logos",
  file: File,
  prefix = "",
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${prefix ? prefix + "/" : ""}${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabaseAdminClient.storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) throw new Error(upErr.message);
  // 10-year signed URL (~315,360,000 seconds)
  const { data, error } = await supabaseAdminClient.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (error || !data) throw new Error(error?.message ?? "Failed to sign URL");
  return data.signedUrl;
}

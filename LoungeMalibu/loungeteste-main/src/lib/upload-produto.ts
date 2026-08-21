import { getSupabase } from "@/integrations/supabase/client";

const BUCKET = "produtos";

export async function uploadFotoProduto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem.");
  if (file.size > 6 * 1024 * 1024) throw new Error("Imagem até 6 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const sb = getSupabase();
  const { error } = await sb.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

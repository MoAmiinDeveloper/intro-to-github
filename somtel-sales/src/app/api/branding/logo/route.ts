import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { uploadPath } from "@/lib/files";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp" };

/** Serves the uploaded logo, or the default /public/logo.png. */
export async function GET() {
  const profile = await prisma.companyProfile.findUnique({ where: { id: "company" } });
  try {
    if (profile?.logoPath) {
      const data = await readFile(uploadPath(profile.logoPath));
      return new Response(new Uint8Array(data), {
        headers: { "Content-Type": TYPES[path.extname(profile.logoPath).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" },
      });
    }
  } catch {
    // fall back to the default logo
  }
  const data = await readFile(path.join(process.cwd(), "public", "logo.png"));
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" } });
}

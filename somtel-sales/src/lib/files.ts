import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export function uploadRoot() {
  return path.resolve(process.env.UPLOAD_DIR || "./data/uploads");
}

/** Resolve a stored relative path, refusing anything outside the upload folder. */
export function uploadPath(relative: string) {
  const root = uploadRoot();
  const full = path.resolve(root, relative);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid file path");
  return full;
}

export async function saveUpload(file: File, folder: string, allowedExt: string[], maxBytes: number) {
  const ext = path.extname(file.name).toLowerCase();
  if (!allowedExt.includes(ext)) throw new Error(`Allowed file types: ${allowedExt.join(", ")}`);
  if (file.size > maxBytes) throw new Error(`File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`);
  const relative = path.join(folder, `${randomUUID()}${ext}`);
  const full = uploadPath(relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return relative;
}

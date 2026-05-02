import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");
const API_URL = process.env.API_URL || "";

// Compress config
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 1280;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 80;

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  async ensureUploadDir(): Promise<void> {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }

  /**
   * Save a buffer to disk after auto-compressing.
   * All images are converted to WebP for optimal size.
   */
  async saveFile(
    buffer: Buffer,
    originalName: string,
    _contentType: string,
  ): Promise<{ servingUrl: string; objectPath: string }> {
    await this.ensureUploadDir();

    // Compress: resize to max 1280px, convert to WebP
    const compressed = await sharp(buffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const filename = `${randomUUID()}.webp`;
    const filePath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(filePath, compressed);

    const objectPath = `/uploads/${filename}`;
    const servingUrl = `${API_URL}/storage${objectPath}`;

    return { servingUrl, objectPath };
  }

  /**
   * Get the absolute file path for a given object path.
   */
  getFilePath(objectPath: string): string {
    const filename = path.basename(objectPath);
    if (filename.includes("..") || filename.includes("/")) {
      throw new ObjectNotFoundError();
    }
    return path.join(UPLOAD_DIR, filename);
  }

  /**
   * Check if a file exists on disk.
   */
  async fileExists(objectPath: string): Promise<boolean> {
    try {
      await fs.access(this.getFilePath(objectPath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file from disk.
   */
  async deleteFile(objectPath: string): Promise<void> {
    try {
      await fs.unlink(this.getFilePath(objectPath));
    } catch {}
  }

  /**
   * Read a file from disk and return buffer + content type.
   */
  async readFile(objectPath: string): Promise<{ buffer: Buffer; contentType: string }> {
    const filePath = this.getFilePath(objectPath);
    try {
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = this.mimeFromExt(ext);
      return { buffer, contentType };
    } catch {
      throw new ObjectNotFoundError();
    }
  }

  private mimeFromExt(ext: string): string {
    const map: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
    };
    return map[ext] || "application/octet-stream";
  }
}

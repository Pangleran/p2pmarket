import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg", "image/jpg", "image/png", "image/gif",
  "image/webp", "image/bmp", "image/tiff",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /storage/upload
 *
 * Direct file upload. Accepts raw binary body with Content-Type header.
 * Returns the serving URL.
 */
router.post("/storage/upload", requireAuth, async (req: AuthRequest, res: Response) => {
  const contentType = req.headers["content-type"] || "";
  const fileName = (req.headers["x-file-name"] as string) || "image.bin";

  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    res.status(400).json({ error: "Only image files are allowed (JPG, PNG, GIF, WEBP)" });
    return;
  }

  // Collect body as buffer
  const chunks: Buffer[] = [];
  let totalSize = 0;

  req.on("data", (chunk: Buffer) => {
    totalSize += chunk.length;
    if (totalSize > MAX_FILE_SIZE) {
      res.status(413).json({ error: "File too large. Max size is 5MB" });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", async () => {
    if (res.headersSent) return;

    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0) {
      res.status(400).json({ error: "Empty file" });
      return;
    }

    try {
      const { servingUrl, objectPath } = await objectStorageService.saveFile(buffer, fileName, contentType);
      res.json({ url: servingUrl, objectPath });
    } catch (error) {
      req.log.error({ err: error }, "Error saving uploaded file");
      res.status(500).json({ error: "Failed to save file" });
    }
  });

  req.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Upload failed" });
    }
  });
});

/**
 * GET /storage/uploads/:filename
 *
 * Serve uploaded files from disk.
 */
router.get("/storage/uploads/:filename", async (req: Request, res: Response) => {
  const filename = req.params.filename;

  if (filename.includes("..") || filename.includes("/") || filename.includes("\\") || filename.includes("%")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const objectPath = `/uploads/${filename}`;

  try {
    const { buffer, contentType } = await objectStorageService.readFile(objectPath);
    res.set({
      "Content-Type": contentType,
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    });
    res.send(buffer);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving file");
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;

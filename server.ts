import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

type PromptRecord = {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
  sourceUrl?: string;
  originalImageUrl?: string;
  originalImageName?: string;
  referenceImageUrl?: string;
  referenceImageName?: string;
  tags: string[];
  likes: number;
  views: number;
  createdAt: string;
};

async function startServer() {
  const app = express();
  const PORT = 3000;
  const DATA_FILE = path.join(process.cwd(), "prompts.json");
  const upload = multer({ storage: multer.memoryStorage() });
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || "imagee-assets";
  const hasSupabaseConfig = Boolean(supabaseUrl && supabaseServiceRoleKey);
  const supabaseAdmin = hasSupabaseConfig
    ? createClient(supabaseUrl!, supabaseServiceRoleKey!, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

  // Middleware
  app.use(express.json({ limit: "50mb" }));

  // Ensure data file exists
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeJsonSync(DATA_FILE, []);
  }

  // API Routes
  app.get("/api/supabase/status", async (_req, res) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY",
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        ok: false,
        error: "Missing SUPABASE_SERVICE_ROLE_KEY",
      });
    }

    const { data, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
      });
    }

    const bucketExists = data.some((bucket) => bucket.name === supabaseBucket);
    return res.json({
      ok: true,
      bucket: supabaseBucket,
      bucketExists,
      publicEnvConfigured: true,
      serviceEnvConfigured: true,
    });
  });

  app.get("/api/prompts", async (req, res) => {
    try {
      const { search } = req.query;
      let prompts = (await fs.readJson(DATA_FILE)) as PromptRecord[];
      
      if (search) {
        const query = (search as string).toLowerCase();
        prompts = prompts.filter((p) => 
          p.prompt.toLowerCase().includes(query) || 
          p.title?.toLowerCase().includes(query) ||
          p.tags?.some((t: string) => t.toLowerCase().includes(query))
        );
      }
      
      res.json(prompts.reverse()); // Newest first
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch prompts" });
    }
  });

  async function uploadImageToSupabase(file: Express.Multer.File, folder: string) {
    if (!supabaseAdmin) {
      throw new Error("Supabase Storage is not configured");
    }

    const fileExt = path.extname(file.originalname) || ".jpg";
    const filePath = `${folder}/${uuidv4()}${fileExt}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(supabaseBucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabaseAdmin.storage.from(supabaseBucket).getPublicUrl(filePath);
    return {
      url: data.publicUrl,
      path: filePath,
    };
  }

  app.post(
    "/api/prompts",
    upload.fields([
      { name: "originalImage", maxCount: 1 },
      { name: "referenceImage", maxCount: 1 },
    ]),
    async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({
          error: "Supabase Storage is not configured. Please set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET.",
        });
      }

      const files = req.files as {
        originalImage?: Express.Multer.File[];
        referenceImage?: Express.Multer.File[];
      };
      const originalImageFile = files?.originalImage?.[0];
      const referenceImageFile = files?.referenceImage?.[0];
      if (!originalImageFile) {
        return res.status(400).json({ error: "Original image is required" });
      }

      const originalUpload = await uploadImageToSupabase(originalImageFile, "originals");
      const referenceUpload = referenceImageFile
        ? await uploadImageToSupabase(referenceImageFile, "references")
        : null;

      const rawTags = req.body.tags;
      let parsedTags: string[] = [];
      if (typeof rawTags === "string") {
        try {
          const candidate = JSON.parse(rawTags);
          parsedTags = Array.isArray(candidate) ? candidate : [];
        } catch {
          parsedTags = rawTags.split(",").map((tag) => tag.trim()).filter(Boolean);
        }
      } else if (Array.isArray(rawTags)) {
        parsedTags = rawTags;
      }

      const newPrompt: PromptRecord = {
        id: uuidv4(),
        title: req.body.title || "Untitled Prompt",
        prompt: req.body.prompt || "",
        imageUrl: originalUpload.url,
        aspectRatio: req.body.aspectRatio || "4:3",
        sourceUrl: req.body.sourceUrl || "",
        originalImageUrl: originalUpload.url,
        originalImageName: originalImageFile.originalname,
        referenceImageUrl: referenceUpload?.url,
        referenceImageName: referenceImageFile?.originalname,
        tags: parsedTags,
        likes: 0,
        views: 0,
        createdAt: new Date().toISOString(),
      };

      const prompts = (await fs.readJson(DATA_FILE)) as PromptRecord[];
      prompts.push(newPrompt);
      await fs.writeJson(DATA_FILE, prompts);

      res.status(201).json(newPrompt);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save prompt" });
    }
  });

  app.post("/api/prompts/:id/like", async (req, res) => {
    try {
      const { id } = req.params;
      const prompts = (await fs.readJson(DATA_FILE)) as PromptRecord[];
      const index = prompts.findIndex((p) => p.id === id);
      
      if (index === -1) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      prompts[index].likes = (prompts[index].likes || 0) + 1;
      await fs.writeJson(DATA_FILE, prompts);

      res.json(prompts[index]);
    } catch (err) {
      res.status(500).json({ error: "Failed to update likes" });
    }
  });

  app.post("/api/prompts/:id/view", async (req, res) => {
    try {
      const { id } = req.params;
      const prompts = (await fs.readJson(DATA_FILE)) as PromptRecord[];
      const index = prompts.findIndex((p) => p.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      prompts[index].views = (prompts[index].views || 0) + 1;
      await fs.writeJson(DATA_FILE, prompts);

      res.json(prompts[index]);
    } catch (err) {
      res.status(500).json({ error: "Failed to update views" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    if (hasSupabaseConfig) {
      console.log(`[supabase] storage enabled for bucket "${supabaseBucket}"`);
    } else {
      console.warn("[supabase] storage disabled: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

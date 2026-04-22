import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import {
  createPromptRecord,
  getSupabaseStatus,
  incrementPromptLike,
  incrementPromptView,
  listPrompts,
} from "./src/lib/server/promptStore";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  app.get("/api/supabase/status", async (_req, res) => {
    const result = await getSupabaseStatus();
    return res.status(result.status).json(result.body);
  });

  app.get("/api/prompts", async (req, res) => {
    try {
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const prompts = await listPrompts(search);
      return res.json(prompts);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch prompts" });
    }
  });

  app.post(
    "/api/prompts",
    async (req, res) => {
      try {
        const prompt = await createPromptRecord({
          title: req.body.title,
          prompt: req.body.prompt,
          aspectRatio: req.body.aspectRatio,
          sourceUrl: req.body.sourceUrl,
          tags: req.body.tags,
          originalImageUrls: req.body.originalImageUrls,
          originalImageNames: req.body.originalImageNames,
        });

        return res.status(201).json(prompt);
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : "Failed to save prompt";
        const status = message === "Original image is required" ? 400 : 500;
        return res.status(status).json({ error: message });
      }
    },
  );

  app.post("/api/prompts/:id/like", async (req, res) => {
    try {
      const prompt = await incrementPromptLike(req.params.id);
      if (!prompt) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      return res.json(prompt);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to update likes" });
    }
  });

  app.post("/api/prompts/:id/view", async (req, res) => {
    try {
      const prompt = await incrementPromptView(req.params.id);
      if (!prompt) {
        return res.status(404).json({ error: "Prompt not found" });
      }

      return res.json(prompt);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to update views" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const status = await getSupabaseStatus();
  if (status.ok) {
    console.log(`[supabase] storage enabled for bucket "${status.body.bucket}"`);
  } else {
    console.warn(`[supabase] storage disabled: ${status.body.error}`);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

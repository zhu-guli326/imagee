import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const DATA_FILE = path.join(process.cwd(), "prompts.json");

  // Middleware
  app.use(express.json({ limit: "50mb" }));

  // Ensure data file exists
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeJsonSync(DATA_FILE, []);
  }

  // API Routes
  app.get("/api/prompts", async (req, res) => {
    try {
      const { search } = req.query;
      let prompts = await fs.readJson(DATA_FILE);
      
      if (search) {
        const query = (search as string).toLowerCase();
        prompts = prompts.filter((p: any) => 
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

  app.post("/api/prompts", async (req, res) => {
    try {
      const { title, prompt, imageUrl, tags } = req.body;
      if (!prompt || !imageUrl) {
        return res.status(400).json({ error: "Prompt and Image URL are required" });
      }

      const newPrompt = {
        id: uuidv4(),
        title: title || "Untitled Prompt",
        prompt,
        imageUrl,
        tags: tags || [],
        likes: 0,
        createdAt: new Date().toISOString(),
      };

      const prompts = await fs.readJson(DATA_FILE);
      prompts.push(newPrompt);
      await fs.writeJson(DATA_FILE, prompts);

      res.status(201).json(newPrompt);
    } catch (err) {
      res.status(500).json({ error: "Failed to save prompt" });
    }
  });

  app.post("/api/prompts/:id/like", async (req, res) => {
    try {
      const { id } = req.params;
      const prompts = await fs.readJson(DATA_FILE);
      const index = prompts.findIndex((p: any) => p.id === id);
      
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
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();

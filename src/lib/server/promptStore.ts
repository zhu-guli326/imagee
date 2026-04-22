import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

export type PromptRecord = {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  aspectRatio?: string;
  sourceUrl?: string;
  originalImageUrl?: string;
  originalImageName?: string;
  originalImageUrls?: string[];
  originalImageNames?: string[];
  referenceImageUrl?: string;
  referenceImageName?: string;
  tags: string[];
  likes: number;
  views: number;
  createdAt: string;
};

type PromptStoreContext = {
  dataFile: string;
  metadataObjectPath: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  supabaseBucket: string;
  useSupabaseMetadataStore: boolean;
};

function getContext(): PromptStoreContext {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || "imagee-assets";
  const useSupabaseMetadataStore =
    process.env.PROMPTS_STORE_MODE === "supabase" ||
    process.env.VERCEL === "1";

  return {
    dataFile: path.join(process.cwd(), "prompts.json"),
    metadataObjectPath: "data/prompts.json",
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    supabaseBucket,
    useSupabaseMetadataStore,
  };
}

function getSupabaseAdminClient(context = getContext()): SupabaseClient | null {
  if (!context.supabaseUrl || !context.supabaseServiceRoleKey) {
    return null;
  }

  return createClient(context.supabaseUrl, context.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureLocalDataFile(dataFile: string) {
  if (!fs.existsSync(dataFile)) {
    await fs.writeJson(dataFile, []);
  }
}

async function loadPromptsFromLocalFile(dataFile: string) {
  await ensureLocalDataFile(dataFile);
  return (await fs.readJson(dataFile)) as PromptRecord[];
}

async function savePromptsToLocalFile(dataFile: string, prompts: PromptRecord[]) {
  await fs.writeJson(dataFile, prompts);
}

async function loadPromptsFromSupabaseStorage(context: PromptStoreContext) {
  const supabaseAdmin = getSupabaseAdminClient(context);
  if (!supabaseAdmin) {
    throw new Error("Supabase Storage is not configured");
  }

  const { data, error } = await supabaseAdmin.storage
    .from(context.supabaseBucket)
    .download(context.metadataObjectPath);

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("not found") ||
      message.includes("no such object") ||
      message.includes("does not exist")
    ) {
      return [] as PromptRecord[];
    }

    throw error;
  }

  const rawText = await data.text();
  if (!rawText.trim()) {
    return [];
  }

  const parsed = JSON.parse(rawText);
  return Array.isArray(parsed) ? (parsed as PromptRecord[]) : [];
}

async function savePromptsToSupabaseStorage(context: PromptStoreContext, prompts: PromptRecord[]) {
  const supabaseAdmin = getSupabaseAdminClient(context);
  if (!supabaseAdmin) {
    throw new Error("Supabase Storage is not configured");
  }

  const payload = Buffer.from(JSON.stringify(prompts));
  const { error } = await supabaseAdmin.storage
    .from(context.supabaseBucket)
    .upload(context.metadataObjectPath, payload, {
      contentType: "application/json; charset=utf-8",
      upsert: true,
    });

  if (error) {
    throw error;
  }
}

export async function listPrompts(search?: string) {
  const context = getContext();
  let prompts = context.useSupabaseMetadataStore
    ? await loadPromptsFromSupabaseStorage(context)
    : await loadPromptsFromLocalFile(context.dataFile);

  if (search) {
    const query = search.toLowerCase();
    prompts = prompts.filter((prompt) =>
      prompt.prompt.toLowerCase().includes(query) ||
      prompt.title?.toLowerCase().includes(query) ||
      prompt.tags?.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  return prompts.reverse();
}

async function savePrompts(prompts: PromptRecord[]) {
  const context = getContext();

  if (context.useSupabaseMetadataStore) {
    await savePromptsToSupabaseStorage(context, prompts);
    return;
  }

  await savePromptsToLocalFile(context.dataFile, prompts);
}

async function readPromptsForMutation() {
  const context = getContext();
  return context.useSupabaseMetadataStore
    ? await loadPromptsFromSupabaseStorage(context)
    : await loadPromptsFromLocalFile(context.dataFile);
}

export async function uploadImageToSupabase(file: UploadedFile, folder: string) {
  const context = getContext();
  const supabaseAdmin = getSupabaseAdminClient(context);
  if (!supabaseAdmin) {
    throw new Error("Supabase Storage is not configured");
  }

  const fileExt = path.extname(file.originalname) || ".jpg";
  const filePath = `${folder}/${uuidv4()}${fileExt}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(context.supabaseBucket)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseAdmin.storage.from(context.supabaseBucket).getPublicUrl(filePath);
  return {
    url: data.publicUrl,
    path: filePath,
  };
}

export function parseTags(rawTags: unknown) {
  if (typeof rawTags === "string") {
    try {
      const candidate = JSON.parse(rawTags);
      return Array.isArray(candidate) ? candidate : [];
    } catch {
      return rawTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    }
  }

  return Array.isArray(rawTags) ? rawTags : [];
}

export async function createPromptRecord(input: {
  title?: string;
  prompt?: string;
  aspectRatio?: string;
  sourceUrl?: string;
  tags?: unknown;
  originalImageFiles?: UploadedFile[];
  originalImageUrls?: string[];
  originalImageNames?: string[];
  referenceImageFile?: UploadedFile;
  referenceImageUrl?: string;
  referenceImageName?: string;
}) {
  const originalImageFiles = input.originalImageFiles || [];
  const providedOriginalImageUrls = input.originalImageUrls || [];
  const providedOriginalImageNames = input.originalImageNames || [];
  const { referenceImageFile } = input;

  if (originalImageFiles.length === 0 && providedOriginalImageUrls.length === 0) {
    throw new Error("Original image is required");
  }

  const originalUploads = originalImageFiles.length > 0
    ? await Promise.all(
        originalImageFiles.map((file) => uploadImageToSupabase(file, "originals")),
      )
    : [];
  const originalImageUrls = originalUploads.length > 0
    ? originalUploads.map((upload) => upload.url)
    : providedOriginalImageUrls;
  const originalImageNames = originalImageFiles.length > 0
    ? originalImageFiles.map((file) => file.originalname)
    : providedOriginalImageNames;
  const primaryOriginalUrl = originalImageUrls[0];
  const primaryOriginalName = originalImageNames[0] || "original-image";
  const referenceUpload = referenceImageFile
    ? await uploadImageToSupabase(referenceImageFile, "references")
    : null;

  const newPrompt: PromptRecord = {
    id: uuidv4(),
    title: input.title || "Untitled Prompt",
    prompt: input.prompt || "",
    imageUrl: primaryOriginalUrl,
    aspectRatio: input.aspectRatio || "4:3",
    sourceUrl: input.sourceUrl || "",
    originalImageUrl: primaryOriginalUrl,
    originalImageName: primaryOriginalName,
    originalImageUrls,
    originalImageNames,
    referenceImageUrl: referenceUpload?.url || input.referenceImageUrl,
    referenceImageName: referenceImageFile?.originalname || input.referenceImageName,
    tags: parseTags(input.tags),
    likes: 0,
    views: 0,
    createdAt: new Date().toISOString(),
  };

  const prompts = await readPromptsForMutation();
  prompts.push(newPrompt);
  await savePrompts(prompts);
  return newPrompt;
}

export async function incrementPromptLike(id: string) {
  const prompts = await readPromptsForMutation();
  const index = prompts.findIndex((prompt) => prompt.id === id);

  if (index === -1) {
    return null;
  }

  prompts[index].likes = (prompts[index].likes || 0) + 1;
  await savePrompts(prompts);
  return prompts[index];
}

export async function incrementPromptView(id: string) {
  const prompts = await readPromptsForMutation();
  const index = prompts.findIndex((prompt) => prompt.id === id);

  if (index === -1) {
    return null;
  }

  prompts[index].views = (prompts[index].views || 0) + 1;
  await savePrompts(prompts);
  return prompts[index];
}

export async function getSupabaseStatus() {
  const context = getContext();
  if (!context.supabaseUrl || !context.supabaseAnonKey) {
    return {
      ok: false,
      status: 500,
      body: { error: "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY" },
    };
  }

  const supabaseAdmin = getSupabaseAdminClient(context);
  if (!supabaseAdmin) {
    return {
      ok: false,
      status: 500,
      body: { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
    };
  }

  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    return {
      ok: false,
      status: 500,
      body: { error: error.message },
    };
  }

  const bucketExists = data.some((bucket) => bucket.name === context.supabaseBucket);
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      bucket: context.supabaseBucket,
      bucketExists,
      publicEnvConfigured: true,
      serviceEnvConfigured: true,
      metadataStore: context.useSupabaseMetadataStore ? "supabase-storage" : "local-file",
    },
  };
}

import { v4 as uuidv4 } from "uuid";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type VisitInput = {
  source: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  landingPath: string;
  landingUrl: string;
  referrer?: string;
  referrerHost?: string;
  userAgent?: string;
};

type VisitStoreContext = {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseBucket: string;
};

function getContext(): VisitStoreContext {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || "imagee-assets",
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

function getVisitObjectPath(createdAt: string) {
  const day = createdAt.slice(0, 10);
  return `data/visits/${day}/${uuidv4()}.json`;
}

export async function saveVisit(input: VisitInput) {
  const context = getContext();
  const supabaseAdmin = getSupabaseAdminClient(context);
  if (!supabaseAdmin) {
    throw new Error("Visit tracking is not configured");
  }

  const createdAt = new Date().toISOString();
  const payload = {
    id: uuidv4(),
    createdAt,
    source: input.source,
    medium: input.medium || "",
    campaign: input.campaign || "",
    term: input.term || "",
    content: input.content || "",
    landingPath: input.landingPath,
    landingUrl: input.landingUrl,
    referrer: input.referrer || "",
    referrerHost: input.referrerHost || "",
    userAgent: input.userAgent || "",
  };

  const objectPath = getVisitObjectPath(createdAt);
  const { error } = await supabaseAdmin.storage
    .from(context.supabaseBucket)
    .upload(objectPath, Buffer.from(JSON.stringify(payload)), {
      contentType: "application/json; charset=utf-8",
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return payload;
}

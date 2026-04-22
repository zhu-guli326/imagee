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

export type VisitRecord = VisitInput & {
  id: string;
  createdAt: string;
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
  const payload: VisitRecord = {
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

function getVisitDayKeys(days: number) {
  const keys: string[] = [];
  const base = new Date();
  for (let i = 0; i < days; i += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - i);
    keys.push(date.toISOString().slice(0, 10));
  }
  return keys;
}

async function loadVisitsForDay(day: string, context: VisitStoreContext) {
  const supabaseAdmin = getSupabaseAdminClient(context);
  if (!supabaseAdmin) {
    throw new Error("Visit tracking is not configured");
  }

  const prefix = `data/visits/${day}`;
  const { data: objects, error: listError } = await supabaseAdmin.storage
    .from(context.supabaseBucket)
    .list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "desc" },
    });

  if (listError) {
    const message = listError.message.toLowerCase();
    if (
      message.includes("not found") ||
      message.includes("no such object") ||
      message.includes("does not exist")
    ) {
      return [] as VisitRecord[];
    }
    throw listError;
  }

  const visitObjects = (objects || []).filter((object) => object.name.endsWith(".json"));
  return await Promise.all(
    visitObjects.map(async (object) => {
      const objectPath = `${prefix}/${object.name}`;
      const { data, error } = await supabaseAdmin.storage
        .from(context.supabaseBucket)
        .download(objectPath);

      if (error) {
        throw error;
      }

      return JSON.parse(await data.text()) as VisitRecord;
    }),
  );
}

export async function loadVisitSummary(days = 7) {
  const context = getContext();
  const dayKeys = getVisitDayKeys(days);
  const visitGroups = await Promise.all(dayKeys.map((day) => loadVisitsForDay(day, context)));
  const visits = visitGroups.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const sourceTotals = new Map<string, number>();
  const mediumTotals = new Map<string, number>();
  const referrerTotals = new Map<string, number>();
  const landingPathTotals = new Map<string, number>();

  visits.forEach((visit) => {
    sourceTotals.set(visit.source || "unknown", (sourceTotals.get(visit.source || "unknown") || 0) + 1);
    mediumTotals.set(visit.medium || "unknown", (mediumTotals.get(visit.medium || "unknown") || 0) + 1);
    referrerTotals.set(visit.referrerHost || "direct", (referrerTotals.get(visit.referrerHost || "direct") || 0) + 1);
    landingPathTotals.set(visit.landingPath || "/", (landingPathTotals.get(visit.landingPath || "/") || 0) + 1);
  });

  const toSortedArray = (input: Map<string, number>) =>
    Array.from(input.entries())
      .map(([label, visitsCount]) => ({ label, visits: visitsCount }))
      .sort((a, b) => b.visits - a.visits);

  return {
    ok: true,
    days,
    totalVisits: visits.length,
    sources: toSortedArray(sourceTotals),
    mediums: toSortedArray(mediumTotals),
    referrers: toSortedArray(referrerTotals),
    landingPaths: toSortedArray(landingPathTotals),
    recent: visits.slice(0, 50),
  };
}

import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  Filter,
  Ghost,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Plus,
  Search,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { cn } from "./lib/utils";

interface Prompt {
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
}

const LIKED_STORAGE_KEY = "liked_prompts";
const VIEWED_PROMPTS_KEY = "viewed_prompts";
const ALL_CATEGORY = "全部作品";
const TAG_OPTIONS = ["UI/UX 设计", "平面海报", "电商海报", "品牌视觉", "插画创意", "好玩的", "有用的"];

const CATEGORY_KEYWORDS = {
  "UI/UX 设计": ["ui", "ux", "dashboard", "app", "web", "mobile", "interface", "saas", "landing", "product", "home office"],
  "平面海报": ["poster", "editorial", "branding", "typography", "portrait", "still life", "art", "abstract", "oil", "illustration"],
  "电商海报": ["e-commerce", "ecommerce", "product", "sale", "campaign", "promotion", "beauty", "fashion", "cosmetic"],
  "品牌视觉": ["brand", "branding", "identity", "logo", "campaign", "cityscape", "neon", "cyberpunk"],
  "插画创意": ["anime", "illustration", "character", "spirit", "robot", "fantasy", "sakura"],
  "好玩的": ["fun", "playful", "creative", "interesting", "anime", "robot", "fantasy", "cyberpunk"],
  "有用的": ["useful", "practical", "app", "dashboard", "tool", "product", "ui", "ux"],
} as const;

function inferCategory(prompt: Prompt) {
  const haystack = [prompt.title, prompt.prompt, ...(prompt.tags || [])]
    .join(" ")
    .toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category;
    }
  }

  return "平面海报";
}

function normalizePrompt(prompt: Prompt): Prompt {
  const primaryImageUrl = prompt.originalImageUrl || prompt.imageUrl;

  return {
    ...prompt,
    title: prompt.title || "未命名作品",
    prompt: prompt.prompt || "暂未填写提示词细节",
    imageUrl: primaryImageUrl,
    aspectRatio: prompt.aspectRatio || "4:3",
    sourceUrl: prompt.sourceUrl || "",
    originalImageUrl: primaryImageUrl,
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    likes: typeof prompt.likes === "number" ? prompt.likes : 0,
    views: typeof prompt.views === "number" ? prompt.views : 0,
    createdAt: prompt.createdAt || new Date().toISOString(),
  };
}

function greatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
}

function formatActualAspectRatio(width: number, height: number) {
  if (!width || !height) return "4:3";
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function aspectRatioLabelToValue(ratio: string) {
  const matched = ratio.match(/^(\d+):(\d+)$/);
  if (!matched) return "4 / 3";

  const width = Number(matched[1]);
  const height = Number(matched[2]);
  if (!width || !height) return "4 / 3";

  return `${width} / ${height}`;
}

function getPrimaryImageUrl(prompt: Prompt) {
  return prompt.originalImageUrl || prompt.imageUrl;
}

function getPromptTitle(prompt: Prompt) {
  const normalizedTitle = (prompt.title || "").trim();
  if (normalizedTitle && normalizedTitle !== "未命名作品") {
    return normalizedTitle;
  }

  const normalizedPrompt = (prompt.prompt || "").trim();
  if (!normalizedPrompt) {
    return "未填写提示词";
  }

  return normalizedPrompt.length > 24
    ? `${normalizedPrompt.slice(0, 24)}...`
    : normalizedPrompt;
}

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

async function getImageSize(imageUrl: string) {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("图片尺寸读取失败"));
    image.src = imageUrl;
  });
}

async function downloadImage(imageUrl: string, filename: string) {
  try {
    if (imageUrl.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = filename;
      link.click();
      return;
    }

    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(imageUrl, "_blank", "noopener,noreferrer");
  }
}

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(LIKED_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const categories = [
    { name: ALL_CATEGORY, icon: LayoutGrid, count: "1.2k" },
    { name: "UI/UX 设计", icon: Sparkles, count: "240" },
    { name: "平面海报", icon: Palette, count: "180" },
    { name: "电商海报", icon: Camera, count: "320" },
    { name: "品牌视觉", icon: Ghost, count: "150" },
    { name: "插画创意", icon: BookOpen, count: "260" },
    { name: "好玩的", icon: Sparkles, count: "96" },
    { name: "有用的", icon: Filter, count: "128" },
  ];

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedIds));
  }, [likedIds]);

  useEffect(() => {
    const syncLikedState = (event: StorageEvent) => {
      if (!event.key || event.key === LIKED_STORAGE_KEY) {
        const saved = localStorage.getItem(LIKED_STORAGE_KEY);
        setLikedIds(saved ? JSON.parse(saved) : []);
      }
    };

    window.addEventListener("storage", syncLikedState);
    return () => window.removeEventListener("storage", syncLikedState);
  }, []);

  const fetchPrompts = async () => {
    try {
      const response = await fetch("/api/prompts");
      if (!response.ok) {
        throw new Error("Failed to fetch prompts");
      }

      const data = (await response.json()) as Prompt[];
      setPrompts(data.map(normalizePrompt));
    } catch (error) {
      console.error(error);
      setPrompts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (id: string) => {
    if (likedIds.includes(id)) return;

    try {
      const response = await fetch(`/api/prompts/${id}/like`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to update like");
      }

      const updatedPrompt = normalizePrompt((await response.json()) as Prompt);
      const nextPrompts = prompts.map((prompt) =>
        prompt.id === id ? updatedPrompt : prompt,
      );
      setPrompts(nextPrompts);
      setLikedIds((prev) => [...prev, id]);
      confetti({
        particleCount: 60,
        spread: 40,
        origin: { y: 0.7 },
        colors: ["#c96442", "#d97757", "#87867f"],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleView = async (id: string) => {
    const viewedRaw = sessionStorage.getItem(VIEWED_PROMPTS_KEY);
    const viewedIds = viewedRaw ? JSON.parse(viewedRaw) as string[] : [];
    if (viewedIds.includes(id)) return;

    const nextViewedIds = [...viewedIds, id];
    sessionStorage.setItem(VIEWED_PROMPTS_KEY, JSON.stringify(nextViewedIds));

    try {
      const response = await fetch(`/api/prompts/${id}/view`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to update view");
      }

      const updatedPrompt = normalizePrompt((await response.json()) as Prompt);
      const nextPrompts = prompts.map((prompt) =>
        prompt.id === id ? updatedPrompt : prompt,
      );
      setPrompts(nextPrompts);
    } catch (error) {
      console.error(error);
    }
  };

  const filteredPrompts = useMemo(() => {
    let result = prompts;

    if (activeCategory !== ALL_CATEGORY) {
      result = result.filter((prompt) => inferCategory(prompt) === activeCategory);
    }

    if (activeTags.length > 0) {
      result = result.filter((prompt) =>
        activeTags.every((tag) => (prompt.tags || []).includes(tag)),
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((prompt) =>
        [prompt.prompt, prompt.title, ...(prompt.tags || [])]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return result;
  }, [prompts, searchQuery, activeCategory, activeTags]);

  const toggleTagFilter = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const clearFilters = () => {
    setActiveCategory(ALL_CATEGORY);
    setActiveTags([]);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-near-black selection:bg-brand/20">
      <nav className="h-20 flex items-center justify-between px-8 bg-white border-b border-border-cream sticky top-0 z-50 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <BookOpen className="text-brand" size={24} />
          <span className="font-serif font-bold text-xl tracking-tight text-near-black select-none">imagee</span>
        </div>

        <div className="flex-2 max-w-2xl mx-12 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone/60 group-focus-within:text-brand transition-colors" size={18} />
            <input
              type="text"
              placeholder="搜索提示词、标签或作品方向..."
              className="w-full bg-[#f2f2f2] border-none rounded-full pl-12 pr-4 focus:ring-2 focus:ring-brand/20 focus:bg-white transition-all text-sm h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="bg-brand text-white px-6 h-11 rounded-full font-bold text-sm shadow-md shadow-brand/20 hover:opacity-90 transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            上传作品
          </button>
          <div className="w-10 h-10 rounded-full bg-sand flex items-center justify-center text-near-black">
            <User size={20} />
          </div>
        </div>
      </nav>

      <div className="bg-white border-b border-border-cream py-4 px-8 sticky top-20 z-40 overflow-x-auto whitespace-nowrap custom-scroll scrollbar-hide">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-bold uppercase tracking-wider transition-colors",
              isFilterPanelOpen || activeTags.length > 0
                ? "bg-near-black text-white border-near-black"
                : "border-border-cream hover:bg-sand",
            )}
          >
            <Filter size={14} />
            筛选
            {activeTags.length > 0 && <span>{activeTags.length}</span>}
          </button>
          <div className="h-6 w-px bg-border-cream" />
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={cn(
                "px-5 py-2 rounded-full text-xs font-bold transition-all",
                activeCategory === cat.name
                  ? "bg-near-black text-white"
                  : "bg-sand/40 text-stone hover:bg-sand hover:text-near-black",
              )}
            >
              {cat.name}
            </button>
          ))}
          {(activeCategory !== ALL_CATEGORY || activeTags.length > 0 || searchQuery) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-full text-xs font-bold bg-sand text-near-black hover:bg-border-cream transition-colors"
            >
              清空筛选
            </button>
          )}
        </div>

        {isFilterPanelOpen && (
          <div className="max-w-7xl mx-auto mt-4 rounded-2xl border border-border-cream bg-ivory/70 p-4">
            <div className="flex flex-wrap items-center gap-3">
              {TAG_OPTIONS.map((tag) => {
                const isSelected = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTagFilter(tag)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                      isSelected
                        ? "bg-brand text-white border-brand"
                        : "bg-white text-stone border-border-warm hover:text-near-black hover:bg-sand/40",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 p-8 md:p-12">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex flex-col gap-4">
                  <div className="aspect-[4/3] bg-sand/30 animate-pulse rounded-xl border border-border-cream" />
                  <div className="h-4 w-3/4 bg-sand/30 animate-pulse rounded" />
                  <div className="h-3 w-1/2 bg-sand/30 animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : filteredPrompts.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-8 [column-fill:_balance]">
              {filteredPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onLike={() => handleLike(prompt.id)}
                  onView={() => handleView(prompt.id)}
                  isLiked={likedIds.includes(prompt.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-border-warm rounded-[32px] bg-white">
              <Ghost size={56} className="mb-6 text-stone opacity-30" />
              <h3 className="font-serif text-2xl mb-2 text-near-black">还没有匹配的作品</h3>
              <p className="text-olive text-sm mb-8 text-center max-w-xs">换个关键词试试，或者先上传你的原图与参考图。</p>
              <button
                onClick={() => {
                  clearFilters();
                }}
                className="btn-claude-secondary px-8 h-12"
              >
                返回主页
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-border-cream py-16 px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-4">
            <BookOpen size={24} className="text-brand" />
            <span className="font-serif font-bold text-xl">imagee</span>
          </div>
          <div className="flex gap-12 text-sm font-bold text-stone">
            <span className="hover:text-near-black cursor-pointer transition-colors">关于我们</span>
            <span className="hover:text-near-black cursor-pointer transition-colors">隐私政策</span>
            <span className="hover:text-near-black cursor-pointer transition-colors">使用条款</span>
          </div>
          <div className="text-[11px] text-stone uppercase tracking-widest font-sans font-bold">
            © 2024 IMAGEE
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isUploadModalOpen && (
          <UploadModal
            onClose={() => setIsUploadModalOpen(false)}
            onSuccess={() => {
              fetchPrompts();
              setIsUploadModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function PromptCard({
  prompt,
  onLike,
  onView,
  isLiked,
}: {
  key?: React.Key;
  prompt: Prompt;
  onLike: () => void | Promise<void>;
  onView: () => void | Promise<void>;
  isLiked: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const primaryImageUrl = getPrimaryImageUrl(prompt);
  const promptTitle = getPromptTitle(prompt);
  const imageAspectRatio = aspectRatioLabelToValue(prompt.aspectRatio || "4:3");
  const [cardElement, setCardElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cardElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            onView();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.45 },
    );

    observer.observe(cardElement);
    return () => observer.disconnect();
  }, [cardElement, onView]);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await navigator.clipboard.writeText(prompt.prompt || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadOriginal = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await downloadImage(primaryImageUrl, `${promptTitle}-original.png`);
  };

  const handleDownloadReference = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!prompt.referenceImageUrl) return;
    await downloadImage(prompt.referenceImageUrl, `${promptTitle}-reference.png`);
  };

  return (
    <motion.div
      ref={setCardElement}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10 inline-block w-full break-inside-avoid group"
    >
      <div
        className="relative w-full rounded-lg overflow-hidden bg-sand mb-4"
        style={{ aspectRatio: imageAspectRatio }}
      >
        <img
          src={primaryImageUrl}
          alt={promptTitle}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />

        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-white text-near-black rounded-full text-xs font-bold transition-all shadow-xl flex items-center gap-2"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "已复制提示词" : "复制提示词"}
            </button>
            <button
              onClick={handleDownloadOriginal}
              className="px-4 py-2 bg-white/90 text-near-black rounded-full text-xs font-bold transition-all shadow-xl flex items-center gap-2"
            >
              <Download size={14} />
              下载原图
            </button>
            {prompt.referenceImageUrl && (
              <button
                onClick={handleDownloadReference}
                className="px-4 py-2 bg-brand text-white rounded-full text-xs font-bold transition-all shadow-xl flex items-center gap-2"
              >
                <Download size={14} />
                下载参考图
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-sm font-bold text-near-black truncate group-hover:text-brand transition-colors mb-1">
            {promptTitle}
          </h3>
          <p className="text-xs text-stone line-clamp-2">
            {prompt.prompt || "暂未填写提示词细节"}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onLike();
            }}
            className={cn(
              "flex items-center gap-1 px-1 py-0.5 transition-all text-[11px] font-bold rounded hover:bg-sand",
              isLiked ? "text-brand" : "text-stone",
            )}
          >
            <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
            <span>{prompt.likes}</span>
          </button>

          <div className="flex items-center gap-1 text-stone text-[11px] font-bold">
            <Eye size={14} />
            <span>{prompt.views}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    prompt: "",
    tags: [] as string[],
    aspectRatio: "4:3",
    sourceUrl: "",
    originalImageUrl: "",
    originalImageName: "",
    originalImageRatio: "",
    referenceImageUrl: "",
    referenceImageName: "",
    referenceImageRatio: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tagError, setTagError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [originalImageFile, setOriginalImageFile] = useState<File | null>(null);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);

  const handleImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: "original" | "reference",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSubmitError("");

    const imageUrl = await fileToDataUrl(file);
    const imageSize = await getImageSize(imageUrl);
    const detectedAspectRatio = formatActualAspectRatio(imageSize.width, imageSize.height);

    if (type === "original") {
      setOriginalImageFile(file);
    } else {
      setReferenceImageFile(file);
    }

    setFormData((prev) => ({
      ...prev,
      aspectRatio: type === "original" ? detectedAspectRatio : prev.aspectRatio,
      [`${type}ImageUrl`]: imageUrl,
      [`${type}ImageName`]: file.name,
      [`${type}ImageRatio`]: detectedAspectRatio,
    }));

    event.target.value = "";
  };

  const clearImage = (type: "original" | "reference") => {
    if (type === "original") {
      setOriginalImageFile(null);
    } else {
      setReferenceImageFile(null);
    }

    setFormData((prev) => ({
      ...prev,
      [`${type}ImageUrl`]: "",
      [`${type}ImageName`]: "",
      [`${type}ImageRatio`]: "",
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    if (!originalImageFile) {
      setSubmitError("请先上传原图。");
      return;
    }
    if (formData.tags.length === 0) {
      setTagError("请至少选择 1 个标签后再发布。");
      return;
    }

    setTagError("");

    setIsSubmitting(true);
    try {
      const trimmedPrompt = formData.prompt.trim();
      const promptTitle = trimmedPrompt
        ? trimmedPrompt.length > 24
          ? `${trimmedPrompt.slice(0, 24)}...`
          : trimmedPrompt
        : "未命名作品";

      const payload = new FormData();
      payload.append("title", promptTitle);
      payload.append("prompt", trimmedPrompt || "暂未填写提示词细节");
      payload.append("aspectRatio", formData.originalImageRatio || formData.aspectRatio || "4:3");
      payload.append("sourceUrl", formData.sourceUrl.trim());
      payload.append("tags", JSON.stringify(formData.tags));
      payload.append("originalImage", originalImageFile);

      if (referenceImageFile) {
        payload.append("referenceImage", referenceImageFile);
      }

      const response = await fetch("/api/prompts", {
        method: "POST",
        body: payload,
      });

      if (!response.ok) {
        let errorMessage = "发布失败，请稍后再试。";
        const rawText = await response.text();

        if (rawText) {
          try {
            const parsed = JSON.parse(rawText) as { error?: string };
            errorMessage = parsed.error || rawText;
          } catch {
            errorMessage = rawText;
          }
        }

        throw new Error(errorMessage);
      }

      onSuccess();
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "发布失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-near-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-3xl rounded-2xl border border-border-cream shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-border-cream flex items-center justify-between">
          <div>
            <h2 className="font-bold text-xl text-near-black">上传原图与参考图</h2>
            <p className="text-sm text-stone mt-1">标题不需要填，上传后可复制提示词，也可下载图片。</p>
          </div>
          <button onClick={onClose} className="text-stone hover:text-near-black transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-7 max-h-[85vh] overflow-y-auto custom-scroll">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploadField
              label="原图"
              hint="必传，上传后会作为作品主图展示"
              previewUrl={formData.originalImageUrl}
              fileName={formData.originalImageName}
              aspectRatio={formData.originalImageRatio}
              inputId="original-image-upload"
              onFileChange={(event) => handleImageChange(event, "original")}
              onClear={() => clearImage("original")}
            />

            <ImageUploadField
              label="参考图"
              hint="可选，可单独上传一张参考图辅助说明"
              previewUrl={formData.referenceImageUrl}
              fileName={formData.referenceImageName}
              aspectRatio={formData.referenceImageRatio}
              inputId="reference-image-upload"
              onFileChange={(event) => handleImageChange(event, "reference")}
              onClear={() => clearImage("reference")}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-stone uppercase tracking-wide">提示词</label>
            <textarea
              rows={6}
              placeholder="输入你的提示词，发布后卡片支持一键复制"
              className="claude-input w-full resize-none rounded-lg p-4 h-36"
              value={formData.prompt}
              onChange={(event) => setFormData({ ...formData, prompt: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-stone uppercase tracking-wide">来源链接 (可选)</label>
            <input
              type="url"
              placeholder="可选，填写作品来源页链接"
              className="claude-input w-full rounded-lg h-12"
              value={formData.sourceUrl}
              onChange={(event) => setFormData({ ...formData, sourceUrl: event.target.value })}
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-stone uppercase tracking-wide">标签 (必选，可多选)</label>
            <div className="flex flex-wrap gap-3">
              {TAG_OPTIONS.map((tag) => {
                const isSelected = formData.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      {
                        setTagError("");
                        setFormData((prev) => ({
                          ...prev,
                          tags: isSelected
                            ? prev.tags.filter((item) => item !== tag)
                            : [...prev.tags, tag],
                        }));
                      }
                    }
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold border transition-all",
                      isSelected
                        ? "bg-near-black text-white border-near-black"
                        : "bg-white text-stone border-border-warm hover:text-near-black hover:bg-sand/40",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className={cn("text-xs", tagError ? "text-brand" : "text-stone")}>
              {tagError || (formData.tags.length > 0
                ? `已选择 ${formData.tags.length} 个标签。`
                : "请至少选择 1 个标签。")}
            </p>
          </div>

          {submitError && (
            <div className="rounded-2xl border border-brand/20 bg-brand/8 px-4 py-3 text-sm text-brand">
              {submitError}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full bg-near-black text-white h-14 rounded-full font-bold text-lg transition-all",
                isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:opacity-90",
              )}
            >
              {isSubmitting ? "正在发布..." : "发布作品"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ImageUploadField({
  label,
  hint,
  previewUrl,
  fileName,
  aspectRatio,
  inputId,
  onFileChange,
  onClear,
}: {
  label: string;
  hint: string;
  previewUrl?: string;
  fileName?: string;
  aspectRatio?: string;
  inputId: string;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onClear: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-xs font-bold text-stone uppercase tracking-wide">
          {label}
        </label>
        {previewUrl && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-bold text-stone hover:text-near-black transition-colors"
          >
            移除
          </button>
        )}
      </div>

      <label
        htmlFor={inputId}
        className="block border border-dashed border-border-warm rounded-2xl bg-ivory/80 hover:bg-white transition-colors cursor-pointer overflow-hidden"
      >
        <input id={inputId} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

        {previewUrl ? (
          <div className="p-4 space-y-4">
            <img src={previewUrl} alt={label} className="w-full h-52 object-cover rounded-xl bg-sand" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-near-black truncate">{fileName || `${label}.png`}</p>
                <p className="text-xs text-stone">
                  {aspectRatio ? `实际比例 ${aspectRatio}` : "点击可重新选择图片"}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white border border-border-cream flex items-center justify-center shrink-0">
                <ImageIcon size={18} className="text-brand" />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 h-full min-h-64 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-white border border-border-cream flex items-center justify-center mb-4">
              <Upload size={22} className="text-brand" />
            </div>
            <p className="text-base font-bold text-near-black mb-2">点击上传{label}</p>
            <p className="text-sm text-stone max-w-xs">{hint}</p>
          </div>
        )}
      </label>
    </div>
  );
}

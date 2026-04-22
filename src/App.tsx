import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Plus, 
  Copy, 
  Heart, 
  Image as ImageIcon, 
  X, 
  Check, 
  TrendingUp,
  Clock,
  LayoutGrid,
  Sparkles,
  Camera,
  Ghost,
  Palette,
  ChevronRight,
  BookOpen,
  ArrowUpRight,
  Filter,
  Eye,
  User
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import confetti from "canvas-confetti";
import seedPrompts from "../prompts.json";

interface Prompt {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  tags: string[];
  likes: number;
  createdAt: string;
}

const PROMPTS_STORAGE_KEY = "prompt_journal_prompts";
const LIKED_STORAGE_KEY = "liked_prompts";

function loadStoredPrompts(): Prompt[] {
  if (typeof window === "undefined") {
    return seedPrompts as Prompt[];
  }

  const stored = localStorage.getItem(PROMPTS_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(seedPrompts));
    return seedPrompts as Prompt[];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : (seedPrompts as Prompt[]);
  } catch {
    localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(seedPrompts));
    return seedPrompts as Prompt[];
  }
}

function savePrompts(prompts: Prompt[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));
}

export default function App() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部作品");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(LIKED_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const categories = [
    { name: "全部作品", icon: LayoutGrid, count: "1.2k" },
    { name: "赛博朋克", icon: Sparkles, count: "240" },
    { name: "写实摄影", icon: Camera, count: "180" },
    { name: "二次元动漫", icon: Ghost, count: "320" },
    { name: "油画风格", icon: Palette, count: "150" }
  ];

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedIds));
  }, [likedIds]);

  const fetchPrompts = () => {
    setPrompts(loadStoredPrompts());
    setIsLoading(false);
  };

  const handleLike = async (id: string) => {
    if (likedIds.includes(id)) return;

    try {
      const nextPrompts = prompts.map((p) =>
        p.id === id ? { ...p, likes: (p.likes || 0) + 1 } : p
      );
      setPrompts(nextPrompts);
      savePrompts(nextPrompts);
      setLikedIds((prev) => [...prev, id]);
      confetti({
        particleCount: 60,
        spread: 40,
        origin: { y: 0.7 },
        colors: ["#c96442", "#d97757", "#87867f"]
      });
    } catch (err) {
      console.error("Failed to like");
    }
  };

  const filteredPrompts = useMemo(() => {
    let result = prompts;
    if (activeCategory !== "全部作品") {
      result = result.filter(p => p.tags.includes(activeCategory.replace("风格", "")));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.prompt.toLowerCase().includes(q) || 
        p.title.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [prompts, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-near-black selection:bg-brand/20">
      {/* Navigation */}
      <nav className="h-20 flex items-center justify-between px-8 bg-white border-b border-border-cream sticky top-0 z-50 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <BookOpen className="text-brand" size={24} />
          <span className="font-serif font-bold text-xl tracking-tight text-near-black select-none">PromptJournal</span>
        </div>

        <div className="flex-2 max-w-2xl mx-12 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone/60 group-focus-within:text-brand transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="搜索任何灵感..." 
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
            分享灵感
          </button>
          <div className="w-10 h-10 rounded-full bg-sand flex items-center justify-center text-near-black">
             <User size={20} />
          </div>
        </div>
      </nav>

      {/* Filter Bar (Horizontal) */}
      <div className="bg-white border-b border-border-cream py-4 px-8 sticky top-20 z-40 overflow-x-auto whitespace-nowrap custom-scroll scrollbar-hide">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 border border-border-cream rounded-full text-xs font-bold uppercase tracking-wider hover:bg-sand transition-colors">
            <Filter size={14} />
            筛选
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
                  : "bg-sand/40 text-stone hover:bg-sand hover:text-near-black"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
              {filteredPrompts.map((prompt) => (
                <PromptCard 
                  key={prompt.id} 
                  prompt={prompt} 
                  onLike={() => handleLike(prompt.id)}
                  isLiked={likedIds.includes(prompt.id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-border-warm rounded-[32px] bg-white">
              <Ghost size={56} className="mb-6 text-stone opacity-30" />
              <h3 className="font-serif text-2xl mb-2 text-near-black">无声的荒野</h3>
              <p className="text-olive text-sm mb-8 text-center max-w-xs">我们尚未在这一领域发现任何灵感的踪迹。或许你可以成为第一个开拓者？</p>
              <button 
                onClick={() => {setSearchQuery(""); setActiveCategory("全部作品");}} 
                className="btn-claude-secondary px-8 h-12"
              >
                返回主页
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer Section */}
      <footer className="bg-white border-t border-border-cream py-16 px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
           <div className="flex items-center gap-4">
              <BookOpen size={24} className="text-brand" />
              <span className="font-serif font-bold text-xl">PromptJournal</span>
           </div>
           <div className="flex gap-12 text-sm font-bold text-stone">
              <span className="hover:text-near-black cursor-pointer transition-colors">关于我们</span>
              <span className="hover:text-near-black cursor-pointer transition-colors">隐私政策</span>
              <span className="hover:text-near-black cursor-pointer transition-colors">使用条款</span>
           </div>
           <div className="text-[11px] text-stone uppercase tracking-widest font-sans font-bold">
             © 2024 PROMPT JOURNAL GALLERY
           </div>
        </div>
      </footer>

      {/* Upload Modal */}
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

function PromptCard({ prompt, onLike, isLiked }: { prompt: Prompt, onLike: () => void | Promise<void>, isLiked: boolean, key?: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col group cursor-pointer"
    >
      {/* Behance Style Image Card */}
      <div className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-sand mb-4">
        <img 
          src={prompt.imageUrl} 
          alt={prompt.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {/* Overlay on hover (Optional, standard on Behance) */}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-6 backdrop-blur-[2px]">
           <button 
             onClick={(e) => { e.stopPropagation(); handleCopy(); }}
             className="px-6 py-2.5 bg-white text-near-black rounded-full text-xs font-bold transition-all shadow-xl"
           >
             {copied ? <Check size={14} className="mx-auto" /> : "预览详情"}
           </button>
        </div>
      </div>
      
      {/* Behance Style Metadata Below Image */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 pr-2">
           <h3 className="text-sm font-bold text-near-black truncate group-hover:text-brand transition-colors mb-0.5">{prompt.title}</h3>
           <p className="text-xs text-stone hover:text-near-black transition-colors">
              AI_Artisan_0x{prompt.id}
           </p>
        </div>
        
        {/* Behance Style Stats on the Right */}
        <div className="flex items-center gap-3 shrink-0">
           <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={cn(
              "flex items-center gap-1 px-1 py-0.5 transition-all text-[11px] font-bold rounded hover:bg-sand",
              isLiked ? "text-brand" : "text-stone"
            )}
           >
            <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
            <span>{prompt.likes}</span>
          </button>
          
          <div className="flex items-center gap-1 text-stone text-[11px] font-bold">
            <Eye size={14} />
            <span>{Math.floor(prompt.likes * 2.5 + 42)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function UploadModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: "",
    prompt: "",
    imageUrl: "",
    tags: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.prompt || !formData.imageUrl) return;

    setIsSubmitting(true);
    try {
      const prompts = loadStoredPrompts();
      const newPrompt: Prompt = {
        id: crypto.randomUUID(),
        title: formData.title || "Untitled Prompt",
        prompt: formData.prompt,
        imageUrl: formData.imageUrl,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        likes: 0,
        createdAt: new Date().toISOString(),
      };

      savePrompts([newPrompt, ...prompts]);
      onSuccess();
    } catch (err) {
      console.error("Upload failed");
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
        className="relative bg-white w-full max-w-xl rounded-2xl border border-border-cream shadow-2xl overflow-hidden"
      >
        <div className="p-8 border-b border-border-cream flex items-center justify-between">
          <h2 className="font-bold text-xl text-near-black">分享创作成果</h2>
          <button onClick={onClose} className="text-stone hover:text-near-black transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-xs font-bold text-stone uppercase tracking-wide">作品标题</label>
                <input 
                  required
                  type="text" 
                  placeholder="请输入标题"
                  className="claude-input w-full rounded-lg h-12"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold text-stone uppercase tracking-wide">图片链接</label>
                <input 
                  required
                  type="url" 
                  placeholder="https://..."
                  className="claude-input w-full rounded-lg h-12"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                />
             </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-stone uppercase tracking-wide">提示词详情 / Prompt</label>
            <textarea 
              required
              rows={5}
              placeholder="在这里输入提示词细节..."
              className="claude-input w-full resize-none rounded-lg p-4 h-32"
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-stone uppercase tracking-wide">标签 (以逗号分隔)</label>
            <input 
              type="text" 
              placeholder="Minimal, Art, AI..."
              className="claude-input w-full rounded-lg h-12"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          <div className="pt-6">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-near-black text-white h-14 rounded-full font-bold text-lg hover:opacity-90 transition-all"
            >
              {isSubmitting ? "正在同步..." : "发布作品"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

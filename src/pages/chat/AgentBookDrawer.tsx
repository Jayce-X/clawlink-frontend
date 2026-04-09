import { useState, useCallback, useRef, useEffect } from "react";
import { X, Search, Star } from "lucide-react";

// ── Search API types ────────────────────────────────────────────
interface SearchSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

interface SearchResult {
  agent_id: string;
  name: string;
  description: string;
  version: string;
  skills: SearchSkill[];
  stars: number;
  provider: { user_id: string; name: string };
  score: number;
}

interface SearchResponse {
  query: string;
  match_type: "exact" | "semantic";
  results: SearchResult[];
}

const SEARCH_TAGS = ["Social Media", "Marketing", "Stock", "Legal", "Translation", "Code", "Data"];

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Props ───────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  onTryAgent: (agent: SearchResult) => void;
  initialQuery?: string;
}

export default function AgentBookDrawer({ open, onClose, onTryAgent, initialQuery }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search API call
  const handleSearch = useCallback(async (query?: string) => {
    const q = (query ?? searchQuery).trim();
    if (!q) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/auth-api/api/agents/search?q=${encodeURIComponent(q)}&top_k=10`);
      if (!res.ok) throw new Error(`Search error: ${res.status}`);
      const data: SearchResponse = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('[AgentBook Search] failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Tag click → search
  const handleTagClick = useCallback((tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
      return;
    }
    setSelectedTag(tag);
    setSearchQuery(tag);
    handleSearch(tag);
  }, [selectedTag, handleSearch]);

  // When panel opens, use initialQuery if provided
  useEffect(() => {
    if (open) {
      if (initialQuery) {
        setSearchQuery(initialQuery);
        setSelectedTag(null);
        // Auto-search with the initial query
        (async () => {
          setLoading(true);
          setHasSearched(true);
          try {
            const res = await fetch(`/auth-api/api/agents/search?q=${encodeURIComponent(initialQuery)}&top_k=10`);
            if (!res.ok) throw new Error(`Search error: ${res.status}`);
            const data: SearchResponse = await res.json();
            setResults(data.results || []);
          } catch (err) {
            console.error('[AgentBook Search] failed:', err);
            setResults([]);
          } finally {
            setLoading(false);
          }
        })();
      } else if (!hasSearched && results.length === 0) {
        handleSearch("agent");
      }
    }
  }, [open, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div className="w-[380px] h-full bg-zinc-50 border-l border-zinc-200/60 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4">
        <h2 className="text-2xl font-light text-zinc-900 tracking-tight">Agents Book</h2>
        <button
          onClick={onClose}
          className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600 transition-colors mt-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-2 rounded-full bg-white border border-zinc-200 px-4 py-2.5">
          <Search className="h-4 w-4 text-zinc-400 flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search the ability you want"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="flex-1 text-sm text-zinc-900 placeholder-zinc-400 outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Tag filters */}
      <div className="px-6 pb-4">
        <div
          className="flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {SEARCH_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedTag === tag
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-200 text-zinc-600 hover:bg-zinc-300"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin" />
              Searching agents...
            </div>
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-400 text-sm">
            暂无匹配的 Agent
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.agent_id}
                className="rounded-2xl bg-white border border-zinc-200/80 p-5 hover:shadow-sm transition-shadow"
              >
                {/* Top row: emoji name / skill + status dot */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base">🤖</span>
                    <span className="text-[15px] font-bold text-zinc-900 truncate">
                      {result.name}
                    </span>
                    <span className="text-zinc-300 text-sm">/</span>
                    <span className="text-[13px] text-zinc-500 flex items-center gap-0.5 truncate">
                      🔧 {result.skills?.[0]?.name || "general"}
                    </span>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400 flex-shrink-0 ml-2" />
                </div>

                {/* Description */}
                <p className="text-[13px] text-zinc-500 leading-relaxed line-clamp-2 mb-3">
                  {result.description}
                </p>

                {/* Footer: owner + stars + @ Try */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Owner */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] text-zinc-400">owner:</span>
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(result.provider?.name || result.agent_id)}&backgroundColor=b6e3f4`}
                        alt=""
                        className="h-5 w-5 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[12px] font-medium text-zinc-700">
                        {result.provider?.name || "Unknown"}
                      </span>
                    </div>
                    {/* Stars */}
                    <span className="flex items-center gap-1 text-[12px] text-zinc-400">
                      <Star className="h-3.5 w-3.5" /> {formatStars(result.stars || 0)}
                    </span>
                  </div>
                  {/* Try button */}
                  <button
                    onClick={() => onTryAgent(result)}
                    className="px-4 py-1.5 rounded-md text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                  >
                    @ Try
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

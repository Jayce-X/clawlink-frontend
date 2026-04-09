import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Star } from "lucide-react";

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
  onTryAgent: (agent: SearchResult) => void;
  initialQuery?: string;
}

export default function AgentBookPage({ onTryAgent, initialQuery }: Props) {
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

  // Auto-search on mount
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
      setSelectedTag(null);
      handleSearch(initialQuery);
    } else if (!hasSearched) {
      handleSearch("agent");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-white items-center overflow-y-auto">
      <div className="w-full max-w-[800px] px-8">
      {/* Title */}
      <div className="pt-8 pb-2">
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Agents Book</h1>
      </div>

      {/* Search bar */}
      <div className="pb-4">
        <div className="flex items-center gap-2 rounded-full bg-zinc-50 border border-zinc-200 px-5 py-3">
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
          <button
            onClick={() => handleSearch()}
            className="px-5 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Tag filters */}
      <div className="pb-5">
        <div className="flex gap-2 flex-wrap">
          {SEARCH_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedTag === tag
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="pb-10">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-400 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin" />
              Searching agents...
            </div>
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 text-sm">
            暂无匹配的 Agent
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.agent_id}
                className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-6 hover:shadow-sm transition-shadow"
              >
                {/* Top row: emoji name / skill + status dot + version */}
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="relative flex h-2.5 w-2.5 flex-shrink-0 ml-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">{result.version || ""}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[13px] text-zinc-500 leading-relaxed mb-3">
                  {result.description}
                </p>

                {/* Footer: owner + stars + credits + @ Try */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-5">
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
                    <span className="flex items-center gap-1 text-[12px] text-amber-500 font-medium">
                      <Star className="h-3.5 w-3.5" /> {formatStars(result.stars || 0)}
                    </span>
                    {/* Credits */}
                    <span className="text-[11px] text-zinc-400">
                      0.3 Credit / 1K·Token
                    </span>
                    {/* Calls */}
                    <span className="text-[11px] text-zinc-400">
                      12.5K Calls
                    </span>
                  </div>
                  {/* Try button */}
                  <button
                    onClick={() => onTryAgent(result)}
                    className="px-5 py-1.5 rounded-md text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
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
    </div>
  );
}

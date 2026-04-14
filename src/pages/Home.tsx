import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Plus, ArrowUp, Star, X } from "lucide-react";
import ChatInput from "../components/ChatInput";
import { getFeaturedAgents } from "../services/api";
import MentionPickerPopup, { type MentionAgent } from "./chat/MentionPickerPopup";
import { useCreateGroup } from "../hooks/useCreateGroup";

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



export default function Home() {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionPreQuery, setMentionPreQuery] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tagBarRef = useRef<HTMLDivElement>(null);
  const { isCreating, handleCreateGroup } = useCreateGroup();
  
  // Track agent name -> real agent_id mapping
  const selectedAgentIds = useRef<Map<string, string>>(new Map());

  // Handle send: extract @-mentioned agents, navigate to chat to create group
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isCreating) return;
    const mentionedNames = [...inputText.matchAll(/@(\S+)/g)].map((m) => m[1]);
    // Resolve names to real agent IDs using the stored mapping
    const agentIds = mentionedNames.map(
      (name) => selectedAgentIds.current.get(name) || name
    );

    // Build name -> id map for the first agent (for pinned mention in ChatPanel)
    const agentNameMap: Record<string, string> = {};
    mentionedNames.forEach((name, i) => {
      agentNameMap[agentIds[i]] = name;
    });

    try {
      await handleCreateGroup(agentIds, agentNameMap, inputText.trim());
    } catch (err) {
      console.error("Failed to handle send from Home:", err);
    }
  }, [inputText, isCreating, handleCreateGroup]);

  // Handle "@ Try" from bottom grid
  const handleTryAgent = useCallback((agentName: string) => {
    setInputText((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} @${agentName} ` : `@${agentName} `;
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  // Handle "@" from MentionPickerPopup
  const handleSelectMentionAgent = useCallback((agent: MentionAgent) => {
    // Store name -> real agent_id mapping
    selectedAgentIds.current.set(agent.name, agent.agent_id);
    setInputText((prev) => {
      const lastAtIndex = prev.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const withoutMention = prev.slice(0, lastAtIndex).trimEnd();
        return withoutMention ? `${withoutMention} @${agent.name} ` : `@${agent.name} `;
      }
      return prev;
    });
    setShowMentionPicker(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
    // Auto-open MentionPickerPopup when user types "@"
    const isTypingNewAt = newValue.slice(-1) === '@' && newValue.length > inputText.length;
    if (isTypingNewAt) {
      setShowMentionPicker(true);
    }
    
    // If picker is open, calculate search query from text before AND after @
    if (showMentionPicker || isTypingNewAt) {
      const textToSearch = newValue.replace(/@/g, ' ').replace(/\s+/g, ' ').trim();
      setMentionPreQuery(textToSearch);
      
      if (newValue.trim() === '') {
        setShowMentionPicker(false);
      }
    }
  };

  return (
    <div className="flex flex-col bg-white">
      {/* ─── First Fold: fills one viewport ─── */}
      <div className="min-h-[calc(100vh-64px)] flex flex-col">

      {/* Hero Section */}
      <div className="flex-shrink-0 flex flex-col items-center pt-48 pb-8 px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-normal text-zinc-900 text-center tracking-tight leading-tight max-w-3xl"
        >
          Access expert agents and skills <br className="hidden md:block" /> worldwide
        </motion.h1>

        {/* Search / Input Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-3xl mt-6"
        >
          <ChatInput
            value={inputText}
            onChange={handleInputChange}
            onSend={handleSend}
            sending={isCreating}
            showAgentBookBtn={true}
            popupDirection="up"
            onOpenAgentBook={() => {
              if (!showMentionPicker) {
                setShowMentionPicker(true);
                setMentionPreQuery("");
                setTimeout(() => inputRef.current?.focus(), 50);
              } else {
                setShowMentionPicker(false);
              }
            }}
            popupNode={
              showMentionPicker ? (
                <MentionPickerPopup
                  preQuery={mentionPreQuery}
                  onSelectAgent={handleSelectMentionAgent}
                  onClose={() => setShowMentionPicker(false)}
                />
              ) : null
            }
          />
        </motion.div>
      </div>


      {/* ─── Bottom of first fold: Onboarding ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="mt-auto px-6 pb-12"
      >
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start gap-10">
          {/* Left: Intro text */}
          <div className="flex-1 min-w-0">
            <h2 className="text-3xl md:text-4xl font-black text-zinc-900 leading-tight mb-4">
              Make Your Agent More Powerful
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Power it with expert agents and skills from around the world
            </p>
          </div>

          {/* Right: Onboarding card */}
          <div className="w-full md:w-[380px] flex-shrink-0">
            <div className="rounded-xl bg-zinc-900 text-white shadow-lg p-6">
              <p className="text-sm font-semibold mb-3">
                Send this to your AI agent to power it up
              </p>
              {/* Copy URL bar */}
              <div className="flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 mb-4">
                <span className="flex-1 text-xs text-emerald-400 font-mono truncate">
                  https://clawlink.world/join/agent-network
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("https://clawlink.world/join/agent-network");
                  }}
                  className="flex items-center justify-center h-6 w-6 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </button>
              </div>
              {/* Steps */}
              <ol className="space-y-1.5">
                <li className="text-xs text-zinc-400 flex gap-2">
                  <span className="text-zinc-500 font-medium">1.</span>
                  Send this to your agent
                </li>
                <li className="text-xs text-zinc-400 flex gap-2">
                  <span className="text-zinc-500 font-medium">2.</span>
                  They sign up
                </li>
                <li className="text-xs text-zinc-400 flex gap-2">
                  <span className="text-zinc-500 font-medium">3.</span>
                  Call on expert agents and skills worldwide with "@"
                </li>
              </ol>
            </div>
          </div>
        </div>
      </motion.div>

      </div>{/* end first fold */}

      {/* ─── Second Fold: Agent Book Grid (below the fold) ─── */}
      <AgentBookGrid onTryAgent={handleTryAgent} />
    </div>
  );
}

// ── Agent Book Grid (fetches from search API) ───────────────────
function AgentBookGrid({ onTryAgent }: { onTryAgent: (name: string) => void }) {
  const [agents, setAgents] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadAgents = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/auth-api/api/agents/search?q=${encodeURIComponent(query)}&top_k=9`);
      if (!res.ok) throw new Error(`Search error: ${res.status}`);
      const data: SearchResponse = await res.json();
      setAgents(data.results || []);
    } catch (err) {
      console.error('[Home AgentGrid] load failed:', err);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents("agent");
  }, [loadAgents]);

  const handleTagClick = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
      loadAgents("agent");
      return;
    }
    setSelectedTag(tag);
    loadAgents(tag);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
      className="px-6 pb-12"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-zinc-900">Agent Book</h2>
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
          >
            See All →
          </button>
        </div>

        {/* Tag filters */}
        <div className="flex gap-2 flex-wrap mb-5">
          {SEARCH_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedTag === tag
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-zinc-300 border-t-zinc-600 animate-spin" />
              Loading agents...
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
            暂无 Agent
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.agent_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-2xl bg-zinc-50 border border-zinc-200/80 p-5 hover:shadow-md transition-all"
              >
                {/* Top: name / skill + breathing dot */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-base flex-shrink-0">🤖</span>
                    <span className="text-[13px] font-bold text-zinc-900 truncate">{agent.name}</span>
                    <span className="text-zinc-300 text-xs flex-shrink-0">/</span>
                    <span className="text-[11px] text-zinc-500 truncate">
                      🔧 {agent.skills?.[0]?.name || "general"}
                    </span>
                  </div>
                  <span className="relative flex h-2.5 w-2.5 flex-shrink-0 ml-2 mt-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  </span>
                </div>

                {/* Description */}
                <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 mb-3">
                  {agent.description}
                </p>

                {/* Footer: owner + stars + Try */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-zinc-400">by:</span>
                      <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(agent.provider?.name || agent.agent_id)}&backgroundColor=b6e3f4`}
                        alt=""
                        className="h-4 w-4 rounded-full"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] font-medium text-zinc-600 truncate max-w-[60px]">
                        {agent.provider?.name || "Unknown"}
                      </span>
                    </div>
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-medium">
                      <Star className="h-3 w-3" /> {formatStars(agent.stars || 0)}
                    </span>
                  </div>
                  <button
                    onClick={() => onTryAgent(agent.agent_id)}
                    className="px-3 py-1 rounded-md text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
                  >
                    @ Try
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { Star } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────
export interface MentionAgent {
  agent_id: string;
  name: string;
  description: string;
  version?: string;
  skills: { id: string; name: string }[];
  stars: number;
  provider?: { user_id: string; name: string };
}

interface MentionPickerProps {
  /** Pre-@ text used as initial search query */
  preQuery: string;
  /** Called when user clicks @ Try on an agent */
  onSelectAgent: (agent: MentionAgent) => void;
  /** Called when picker should close */
  onClose: () => void;
  /** Optional: group members to show in top section */
  groupMembers?: { userID: string; nick: string; avatar: string; role: string }[];
  /** Optional: called when a group member is selected */
  onSelectMember?: (member: { userID: string; nick: string; avatar: string }) => void;
  /** Optional: currently pinned member userID */
  pinnedMemberID?: string | null;

}

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

// ── MentionPickerPopup ──────────────────────────────────────────
export default function MentionPickerPopup({
  preQuery,
  onSelectAgent,
  onClose,
  groupMembers,
  onSelectMember,
  pinnedMemberID,

}: MentionPickerProps) {
  const [agents, setAgents] = useState<MentionAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const popupRef = React.useRef<HTMLDivElement>(null);

  // Fetch agents whenever preQuery changes (debounced)
  useEffect(() => {
    let isSubscribed = true;
    const query = preQuery.trim() || "agent";
    
    // Abort controller for timeout
    const controller = new AbortController();

    // Debounce: wait 300ms after the last keystroke before fetching
    const debounceId = setTimeout(() => {
      setLoading(true);
      fetch(`/auth-api/api/agents/search?q=${encodeURIComponent(query)}&top_k=10`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (isSubscribed) {
            setAgents(data.results || []);
          }
        })
        .catch((err) => {
          if (isSubscribed && err.name !== 'AbortError') {
            console.error("[MentionPicker] Failed:", err);
            setAgents([]);
          }
        })
        .finally(() => {
          if (isSubscribed) {
            setLoading(false);
          }
        });
    }, 300);
      
    return () => {
      isSubscribed = false;
      clearTimeout(debounceId);
      controller.abort();
    };
  }, [preQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close if they clicked inside the popup
      if (popupRef.current && popupRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className="bg-white rounded-2xl shadow-2xl border border-zinc-200 z-50 overflow-hidden flex flex-col"
      style={{ maxHeight: "100%" }}
    >

      {/* Group members (if in group chat) */}
      {groupMembers && groupMembers.length > 0 && (
        <div className="border-b border-zinc-100 flex-shrink-0">
          <div className="px-5 pt-3 pb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
              群内成员
            </span>
            <span className="text-[10px] text-zinc-300">
              {groupMembers.length} 人
            </span>
          </div>
          <div className="px-4 pb-3 overflow-x-auto">
            <div
              className="grid grid-rows-2 grid-flow-col gap-1.5"
              style={{ minWidth: "max-content" }}
            >
              {groupMembers.map((m) => (
                <button
                  key={m.userID}
                  onClick={() => onSelectMember?.(m)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-left whitespace-nowrap ${
                    pinnedMemberID === m.userID
                      ? "bg-indigo-50 ring-1 ring-indigo-200"
                      : "hover:bg-zinc-50"
                  }`}
                  style={{ minWidth: 160 }}
                >
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {m.avatar ? (
                      <img
                        src={m.avatar}
                        alt=""
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-[8px] font-bold text-white">
                        {(m.nick || m.userID).charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-700 truncate max-w-[110px]">
                      {m.nick || m.userID}
                    </div>
                  </div>
                  {m.role === "Owner" && (
                    <span className="text-[9px] text-amber-600 font-medium">
                      群主
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-3 pb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            全局 AGENTS
          </span>
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            关闭
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-zinc-300">
            加载中...
          </div>
        ) : agents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-zinc-300">
            暂无匹配的 Agent
          </div>
        ) : (
          <div className="flex flex-col pb-2">
            {agents.map((agent, index) => (
              <div
                key={agent.agent_id}
                className="relative bg-white hover:bg-zinc-50 px-5 py-4 transition-colors"
              >
                {index !== agents.length - 1 && (
                  <div className="absolute bottom-0 left-5 right-5 h-[1px] bg-zinc-200/80" />
                )}
                {/* Top row: name / skill + stats + Try */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">🤖</span>
                    <span className="text-[13px] font-bold text-zinc-900 truncate">
                      {agent.name}
                    </span>
                    <span className="text-zinc-300 text-xs">/</span>
                    <span className="text-[11px] text-zinc-500 flex items-center gap-0.5 truncate">
                      🔧 {agent.skills?.[0]?.name || "general"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="flex items-center gap-0.5 text-[11px] text-amber-500 font-medium">
                      {formatStars(agent.stars || 0)}{" "}
                      <Star className="h-3 w-3" />
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      0.3 Credit / 1K·Token
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      12.5K Calls
                    </span>
                    <button
                      onClick={() => onSelectAgent(agent)}
                      className="px-3 py-1 rounded-md text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
                    >
                      @ Try
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-2 line-clamp-2">
                  {agent.description}
                </p>

                {/* Owner */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-zinc-400">Owner:</span>
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                      agent.provider?.name || agent.agent_id
                    )}&backgroundColor=b6e3f4`}
                    alt=""
                    className="h-4 w-4 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[11px] font-medium text-zinc-700">
                    {agent.provider?.name || "Unknown"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SquarePen, MessageSquare, X } from "lucide-react";
import type { TIMConversation } from "../../services/timService";
import { TIM_TYPES, getChatSDK } from "../../services/timService";
import { useTIM } from "../../contexts/TIMContext";
import { useAuth } from "../../contexts/AuthContext";

interface Props {
  conversations: TIMConversation[];
  activeConversationId: string | null;
  isNewChatActive?: boolean;
  onSelect: (conv: TIMConversation) => void;
  onNewChat: () => void;
  onAgentBook: () => void;
  onDeleteConversation?: (convId: string) => void;
  loading?: boolean;
}

/** Get display name for a conversation */
function getConversationName(conv: TIMConversation): string {
  if (conv.type === TIM_TYPES.CONV_GROUP) {
    return conv.groupProfile?.name || conv.groupID || "群聊";
  }
  return conv.userProfile?.nick || conv.userID || "私聊";
}

// ── Agent Book icon ─────────────────────────────────────────────
function AgentBookIcon({ className }: { className?: string }) {
  return (
    <img
      src="/agent-book-icon.png"
      alt="Agent Book"
      className={className}
    />
  );
}

// ── Conversation row ────────────────────────────────────────────
function ConversationRow({
  conv,
  isActive,
  onSelect,
  onDelete,
}: {
  conv: TIMConversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: (convId: string) => void;
}) {
  const name = getConversationName(conv);
  const unread = conv.unreadCount || 0;

  return (
    <button
      onClick={onSelect}
      className={`group w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${ 
        isActive
          ? "bg-zinc-200/80"
          : "hover:bg-zinc-100"
      }`}
    >
      {/* Title — bold, no icon */}
      <span
        className={`flex-1 truncate text-[13px] ${
          isActive ? "text-zinc-900 font-semibold" : "text-zinc-400 font-medium"
        }`}
      >
        {name}
      </span>

      {/* Unread dot */}
      {unread > 0 && (
        <span className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
      )}

      {/* Delete button (show on hover) */}
      <button
        onClick={async (e) => {
          e.stopPropagation();
          try {
            const chat = getChatSDK();
            await chat.deleteConversation(conv.conversationID);
            if (onDelete) onDelete(conv.conversationID);
            // Re-render is handled by TIM SDK firing CONVERSATION_LIST_UPDATED event automatically
          } catch (err) {
            console.error("Failed to delete conversation:", err);
          }
        }}
        className="opacity-0 group-hover:opacity-100 flex items-center justify-center p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-all ml-1"
        title="关闭会话"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </button>
  );
}

export default function ConversationList({
  conversations,
  activeConversationId,
  isNewChatActive = false,
  onSelect,
  onNewChat,
  onAgentBook,
  onDeleteConversation,
  loading = false,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const { userID: currentUserID } = useTIM();
  const { user } = useAuth();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    // Only show group conversations (hide C2C private chats)
    const convs = conversations.filter((c) => c.type === TIM_TYPES.CONV_GROUP);
    if (!searchQuery.trim()) return convs;
    const q = searchQuery.toLowerCase();
    return convs.filter((c) => {
      const name = getConversationName(c).toLowerCase();
      const lastMsg = c.lastMessage?.messageForShow?.toLowerCase() || "";
      return name.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchQuery]);

  return (
    <div className="flex flex-col h-full w-[260px] bg-zinc-50/80 border-r border-zinc-200/50 flex-shrink-0">
      {/* Top: 新聊天 button */}
      <div className="px-3 pt-5 pb-1">
        <button
          onClick={onNewChat}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-[17px] font-bold transition-colors ${
            isNewChatActive
              ? "bg-zinc-200/80 text-zinc-900"
              : "text-zinc-900 hover:bg-zinc-100"
          }`}
        >
          <SquarePen className="h-6 w-6" />
          新聊天
        </button>
      </div>

      {/* Agent Book button */}
      <div className="px-3 pb-2">
        <button
          onClick={onAgentBook}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-[17px] font-bold text-zinc-900 hover:bg-zinc-100 transition-colors"
        >
          <AgentBookIcon className="h-6 w-6" />
          Agent Book
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
            加载中...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
            <MessageSquare className="h-8 w-8 text-zinc-200" />
            <p className="text-xs">{searchQuery ? "无搜索结果" : "暂无会话"}</p>
          </div>
        ) : (
          <>
            {/* Section label */}
            <p className="text-[15px] font-medium text-zinc-500 px-3 pt-3 pb-2">
              你的会话
            </p>
            <div className="space-y-0.5">
              {filtered.map((conv) => (
                <ConversationRow
                  key={conv.conversationID}
                  conv={conv}
                  isActive={activeConversationId === conv.conversationID}
                  onSelect={() => onSelect(conv)}
                  onDelete={onDeleteConversation}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom: User profile */}
      <div className="px-3 py-3 border-t border-zinc-200/50">
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-400 flex items-center justify-center overflow-hidden ring-2 ring-zinc-200 flex-shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-white">
                {user?.email?.charAt(0).toUpperCase() || "G"}
              </span>
            )}
          </div>
          <span className="text-sm text-zinc-700 font-medium truncate">
            {user?.email || "用户"}
          </span>
        </div>
      </div>
    </div>
  );
}

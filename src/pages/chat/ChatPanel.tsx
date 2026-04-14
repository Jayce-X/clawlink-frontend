import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Link, useLocation } from "react-router-dom";
import { Hash, User, Users, X, Loader2, Plus, ArrowUp, ThumbsUp, XCircle, MessageCircle, Trash2 } from "lucide-react";
import {
  getChannelMessages, getChannelMembers, getChannelProfile,
  getC2CMessages, sendTextMessage, sendC2CTextMessage, sendTextAtMessage,
  joinChannel, getUserProfiles, addMembersToGroup, removeMembersFromGroup,
  getChatSDK, TIM_EVENT, TIM_TYPES,
  type TIMConversation,
} from "../../services/timService";
import type { HubMessage, HubReaction } from "../../types";
import MentionPickerPopup, { type MentionAgent } from "./MentionPickerPopup";
import ChatInput from "../../components/ChatInput";

interface Props {
  conversation: TIMConversation;
  onStartDM?: (member: { userID: string; nick: string; avatar: string }) => void;
  onOpenAgentBook?: () => void;
  onError?: (message: string) => void;
}

// ── Convert TIM message to HubMessage ───────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function timMsgToHub(msg: any): HubMessage | null {
  if (msg.type === TIM_TYPES.MSG_GRP_TIP || msg.type === TIM_TYPES.MSG_GRP_SYS_NOTICE) {
    return null;
  }

  // Filter out TIM's auto-generated group creation notification
  // It arrives as TIMCustomElem with businessID="group_create" inside payload.data
  if (msg.type === TIM_TYPES.MSG_CUSTOM && msg.payload?.data) {
    try {
      const customData = JSON.parse(msg.payload.data);
      if (customData.businessID === 'group_create') {
        return null;
      }
    } catch { /* not JSON, proceed normally */ }
  }

  let textContent = "";

  // Handle different message types
  if (msg.type === TIM_TYPES.MSG_TEXT && msg.payload?.text) {
    textContent = msg.payload.text;
  } else if (msg.type === TIM_TYPES.MSG_IMAGE) {
    // TIM image message — extract the image URL from imageInfoArray
    // imageInfoArray contains: [{ imageUrl, width, height, size }, ...] for different sizes
    // Index 0 = original, 1 = large/thumbnail, 2 = small
    const imageInfo = msg.payload?.imageInfoArray;
    if (Array.isArray(imageInfo) && imageInfo.length > 0) {
      // Prefer index 0 (original) or 1 (large)
      const img = imageInfo[0] || imageInfo[1];
      const url = img?.imageUrl || img?.url || '';
      textContent = url ? `![图片](${url})` : '[图片]';
    } else {
      textContent = '[图片]';
    }
  } else if (msg.type === TIM_TYPES.MSG_FILE) {
    const fileName = msg.payload?.fileName || '文件';
    const fileUrl = msg.payload?.fileUrl || '';
    textContent = fileUrl ? `📎 [${fileName}](${fileUrl})` : `📎 ${fileName}`;
  } else if (msg.type === TIM_TYPES.MSG_VIDEO) {
    const videoUrl = msg.payload?.videoUrl || '';
    textContent = videoUrl ? `![视频](${videoUrl})` : '[视频]';
  } else if (msg.type === TIM_TYPES.MSG_AUDIO) {
    textContent = '[语音消息]';
  } else if (msg.type === TIM_TYPES.MSG_CUSTOM) {
    // Custom message — try to parse data
    const data = msg.payload?.data;
    if (data) {
      try {
        const parsed = JSON.parse(data);
        textContent = parsed.text || parsed.content || parsed.description || data;
      } catch {
        textContent = data;
      }
    } else {
      textContent = msg.payload?.description || '[自定义消息]';
    }
  } else if (msg.payload?.text) {
    textContent = msg.payload.text;
  } else if (msg.payload?.data) {
    textContent = msg.payload.data;
  } else {
    const elems = msg._elements || msg.elements || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of elems) {
      if (e.type === "TIMTextElem") {
        textContent = e.content?.Text || e.content?.text || "";
        break;
      }
      if (e.type === "TIMImageElem") {
        const imgList = e.content?.ImageInfoArray || e.content?.imageInfoArray || [];
        if (imgList.length > 0) {
          const url = imgList[0]?.URL || imgList[0]?.imageUrl || '';
          textContent = url ? `![图片](${url})` : '[图片]';
        }
        break;
      }
    }
    if (!textContent) textContent = "[unsupported message]";
  }

  // Parse custom data for reactions
  let reactionsFromCustomData: HubReaction[] = [];
  try {
    const customData = JSON.parse(msg.cloudCustomData || '{}');
    if (customData.reactions && typeof customData.reactions === 'object') {
      reactionsFromCustomData = Object.entries(customData.reactions)
        .filter(([, agents]) => Array.isArray(agents) && (agents as string[]).length > 0)
        .map(([emoji, agents]) => ({
          emoji,
          count: (agents as string[]).length,
          agents: agents as string[],
        }));
    }
  } catch { /* ignore */ }

  return {
    id: msg.ID || msg.id || `${msg.time}-${msg.sequence}`,
    agentId: msg.from || msg.nick || "unknown",
    agentName: msg.nick || msg.from || "Agent",
    avatarUrl: msg.avatar || "",
    content: textContent,
    type: "message",
    reactions: reactionsFromCustomData.length > 0 ? reactionsFromCustomData : undefined,
    timestamp: msg.time ? new Date(msg.time * 1000).toISOString() : new Date().toISOString(),
  };
}

// ── Helpers for AI detection & mock avatars ─────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isAIAgent(userID: string): boolean {
  return UUID_RE.test(userID);
}
function getMockAvatar(id: string, isAI: boolean): string {
  if (isAI) {
    return `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(id)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(id)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

// ── Resolve attachment:// URLs to real backend URLs ──────────
function resolveImageUrl(url: string): string {
  if (url.startsWith('attachment://')) {
    const filename = url.replace('attachment://', '');
    // Try the backend attachment API
    return `/auth-api/api/attachments/${encodeURIComponent(filename)}`;
  }
  return url;
}

// ── Render message content (supports markdown images) ───────
function renderMessageContent(content: string) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: (string | { alt: string; url: string })[] = [];
  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push({ alt: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  if (parts.length === 1 && typeof parts[0] === 'string') {
    return content;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return <span key={i}>{part}</span>;
        }
        const resolvedUrl = resolveImageUrl(part.url);
        return (
          <ImageWithFallback
            key={i}
            src={resolvedUrl}
            alt={part.alt}
          />
        );
      })}
    </>
  );
}

// ── Image component with fallback placeholder ───────────────
function ImageWithFallback({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 text-zinc-500 text-xs my-1 max-w-[280px]">
        <span>📷</span>
        <span className="truncate">{alt || '图片暂无法显示'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="max-w-full rounded-lg my-2 block"
      style={{ maxHeight: 300 }}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}


function AIBadge() {
  return (
    <span
      className="inline-flex items-center px-1 py-[1px] rounded text-[8px] font-bold tracking-wide leading-none flex-shrink-0"
      style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: '#fff',
        letterSpacing: '0.04em',
      }}
    >
      AI
    </span>
  );
}

// ── Members Drawer ──────────────────────────────────────────

interface MembersDrawerProps {
  members: { userID: string; nick: string; avatar: string; role: string }[];
  onClose: () => void;
  onStartDM?: (member: { userID: string; nick: string; avatar: string }) => void;
  isOwner?: boolean;
  onRemoveMember?: (userID: string) => void;
}

function MembersDrawer({ members, onClose, onStartDM, isOwner, onRemoveMember }: MembersDrawerProps) {
  const [memberToRemove, setMemberToRemove] = useState<{userID: string, nick: string} | null>(null);

  return (
    <div className="w-[240px] h-full bg-white border-l border-zinc-200 flex flex-col flex-shrink-0 relative">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
        <span className="text-sm font-bold text-zinc-900">成员 ({members.length})</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-zinc-100 transition-colors">
          <X className="h-4 w-4 text-zinc-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {members.map((m) => {
          const isAI = isAIAgent(m.userID);
          const avatarUrl = m.avatar || getMockAvatar(m.userID, isAI);
          const avatarShape = isAI ? "rounded-lg" : "rounded-full";

          return (
            <div
              key={m.userID}
              className="flex items-center gap-3 px-4 py-2 hover:bg-zinc-50 transition-colors group relative"
            >
              <div className={`h-8 w-8 ${avatarShape} overflow-hidden flex items-center justify-center flex-shrink-0 ${
                isAI ? "bg-gradient-to-br from-indigo-100 to-violet-100" : "bg-gradient-to-br from-zinc-300 to-zinc-200"
              }`}>
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-zinc-800 font-medium truncate">{m.nick || m.userID}</p>
                  {isAI && <AIBadge />}
                </div>
                {m.role === "Owner" && (
                  <span className="text-[10px] text-amber-600 font-medium">群主</span>
                )}
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {/* DM button */}
                {onStartDM && m.role !== "Owner" && (
                  <button
                    onClick={() => onStartDM({ userID: m.userID, nick: m.nick, avatar: avatarUrl })}
                    className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-indigo-50 text-zinc-400 hover:text-indigo-500 transition-all"
                    title={`私聊 ${m.nick || m.userID}`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* Remove button (Only for owner, cannot remove owner) */}
                {isOwner && onRemoveMember && m.role !== "Owner" && (
                  <button
                    onClick={() => setMemberToRemove({ userID: m.userID, nick: m.nick || m.userID })}
                    className="flex items-center justify-center h-7 w-7 rounded-full hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-all"
                    title={`移出群聊 ${m.nick || m.userID}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {memberToRemove && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-zinc-200 p-5 w-full flex flex-col items-center text-center">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <Trash2 className="h-5 w-5 text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 mb-1">移出群聊</h3>
            <p className="text-xs text-zinc-500 mb-5 break-words w-full">确定要将 {memberToRemove.nick} 移出吗？</p>
            <div className="flex gap-2 w-full">
              <button 
                onClick={() => setMemberToRemove(null)}
                className="flex-1 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  onRemoveMember?.(memberToRemove.userID);
                  setMemberToRemove(null);
                }}
                className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Module-level cache — survives React StrictMode unmount/remount ──
// TIM SDK's getMessageList consumes an internal cursor; the second call
// returns 0 messages. We cache results keyed by conversationID.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _chatLoadCache: Record<string, { msgs: HubMessage[]; members: any[]; header: any; ts: number }> = {};

// ── Chat Panel Component ────────────────────────────────────

export interface ChatPanelHandle {
  appendAgentMention: (nameOrId: string, avatarUrl?: string) => void;
  addSystemMessage: (text: string) => void;
  addMemberLocally: (member: { userID: string; nick: string; avatar: string; role: string }) => void;
  hasMemberLocally: (userID: string) => boolean;
}

const ChatPanel = forwardRef<ChatPanelHandle, Props & { onError?: (msg: string) => void }>(function ChatPanel({ conversation, onStartDM, onOpenAgentBook, onError }, ref) {
  const chatLocation = useLocation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialPinned = (chatLocation.state as any)?.initialPinnedAgent || null;

  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [members, setMembers] = useState<{ userID: string; nick: string; avatar: string; role: string }[]>([]);
  const membersRef = useRef(members);
  membersRef.current = members;

  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [pinnedMention, setPinnedMention] = useState<{ userID: string; nick: string; avatar: string } | null>(
    initialPinned ? { userID: initialPinned.userID, nick: initialPinned.nick, avatar: "" } : null
  );
  const [isOwner, setIsOwner] = useState(false);
  const [myUserID, setMyUserID] = useState("");

  useImperativeHandle(ref, () => ({
    appendAgentMention(nameOrId: string, avatarUrl: string = "") {
      // First append text fallback
      setMessageInput((prev) => {
        const lastAtIndex = prev.lastIndexOf("@");
        if (lastAtIndex !== -1) {
          const withoutMention = prev.slice(0, lastAtIndex).trimEnd();
          return withoutMention ? `${withoutMention} ` : ``;
        }
        return prev;
      });
      // Then pin it
      setPinnedMention({ userID: nameOrId, nick: nameOrId, avatar: avatarUrl });
    },
    addSystemMessage(text: string) {
      setMessages((prev) => [...prev, {
        id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        agentId: "system",
        agentName: "System",
        content: text,
        type: "system",
        timestamp: new Date().toISOString()
      }]);
    },
    addMemberLocally(member: { userID: string; nick: string; avatar: string; role: string }) {
      setMembers((prev) => {
        const existing = prev.find(m => m.userID === member.userID);
        if (existing) return prev;
        return [...prev, member];
      });
    },
    hasMemberLocally(userID: string) {
      return !!membersRef.current.find(m => m.userID === userID);
    }
  }));
  const [mentionPreQuery, setMentionPreQuery] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [headerInfo, setHeaderInfo] = useState<{ name: string; subtitle: string; avatar: string }>({
    name: "", subtitle: "", avatar: "",
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const avatarCacheRef = useRef<Record<string, string>>({});
  const nickCacheRef = useRef<Record<string, string>>({});

  const isGroup = conversation.type === TIM_TYPES.CONV_GROUP;
  const targetId = isGroup ? conversation.groupID! : conversation.userID!;


  // ── Mark as read when opening a conversation ──────────────
  useEffect(() => {
    const chat = getChatSDK();
    chat.setMessageRead({ conversationID: conversation.conversationID }).catch(() => {});
  }, [conversation.conversationID]);

  // ── Load conversation data ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const cacheKey = conversation.conversationID;
    const cached = _chatLoadCache[cacheKey];

    // If cached within the last 2 seconds (StrictMode re-run), use cache
    if (cached && Date.now() - cached.ts < 2000) {
      console.log('[ChatPanel] using cached data for', targetId, '— msgs:', cached.msgs.length);
      setMessages(cached.msgs);
      setMembers(cached.members);
      setHeaderInfo(cached.header);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessages([]);
    setMembers([]);
    setShowMembers(false);

    async function load() {
      try {
        if (isGroup) {
          // Auto-join group (may fail for Community groups, that's ok)
          try {
            await joinChannel(targetId);
          } catch (joinErr) {
            console.warn('[ChatPanel] joinChannel failed:', targetId, joinErr);
          }

          // Small delay to let SDK sync after join
          await new Promise(r => setTimeout(r, 200));

          if (cancelled) return;

          const [profile, memberList, msgResult, myProfileRes] = await Promise.all([
            getChannelProfile(targetId).catch((e) => { console.warn('[ChatPanel] getChannelProfile error:', e); return null; }),
            getChannelMembers(targetId, 100).catch((e) => { console.warn('[ChatPanel] getChannelMembers error:', e); return []; }),
            getChannelMessages(targetId, 30).catch((e) => { console.error('[ChatPanel] getChannelMessages error:', targetId, e); return { messageList: [] }; }),
            getChatSDK().getMyProfile().catch(() => ({ data: { userID: "" } })),
          ]);

          console.log('[ChatPanel] loaded for', targetId, '— msgs:', msgResult.messageList?.length, 'members:', memberList.length);

          if (cancelled) return;

          const myUserID = myProfileRes?.data?.userID || "";
          setMyUserID(myUserID);
          
          setIsOwner(profile?.ownerID === myUserID);

          const header = {
            name: profile?.name || conversation.groupProfile?.name || targetId,
            subtitle: `${memberList.length} 名成员`,
            avatar: profile?.avatar || conversation.groupProfile?.avatar || "",
          };
          setHeaderInfo(header);

          // Process members
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const processedMembers = (memberList as any[]).map((m: any) => ({
            userID: m.userID,
            nick: m.nick || m.userID,
            avatar: m.avatar || "",
            role: m.role || "Member",
          }));
          setMembers(processedMembers);

          // Cache avatars/nicks
          for (const m of processedMembers) {
            if (m.avatar) avatarCacheRef.current[m.userID] = m.avatar;
            if (m.nick) nickCacheRef.current[m.userID] = m.nick;
          }

          // Enrich messages with profile data
          const rawMsgs = msgResult.messageList || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const senderIds = [...new Set(rawMsgs.map((m: any) => m.from).filter(Boolean))] as string[];
          const unknownSenders = senderIds.filter(id => !nickCacheRef.current[id]);
          if (unknownSenders.length > 0) {
            const profiles = await getUserProfiles(unknownSenders).catch(() => ({}));
            for (const [uid, p] of Object.entries(profiles)) {
              if (p.avatar) avatarCacheRef.current[uid] = p.avatar;
              if (p.nick) nickCacheRef.current[uid] = p.nick;
            }
          }

          const hubMsgs = rawMsgs
            .map(timMsgToHub)
            .filter((m): m is HubMessage => m !== null)
            .map((m) => ({
              ...m,
              agentName: nickCacheRef.current[m.agentId] || m.agentName,
              avatarUrl: avatarCacheRef.current[m.agentId] || m.avatarUrl || "",
            }));

          if (!cancelled) {
            setMessages(hubMsgs);
            // Cache the result for StrictMode re-run
            _chatLoadCache[cacheKey] = { msgs: hubMsgs, members: processedMembers, header, ts: Date.now() };
          }
        } else {
          // C2C conversation
          const msgResult = await getC2CMessages(targetId, 30).catch(() => ({ messageList: [] }));
          if (cancelled) return;

          const header = {
            name: conversation.userProfile?.nick || targetId,
            subtitle: "私聊",
            avatar: conversation.userProfile?.avatar || "",
          };
          setHeaderInfo(header);

          const hubMsgs = (msgResult.messageList || [])
            .map(timMsgToHub)
            .filter((m): m is HubMessage => m !== null);

          if (!cancelled) {
            setMessages(hubMsgs);
            _chatLoadCache[cacheKey] = { msgs: hubMsgs, members: [], header, ts: Date.now() };
          }
        }
      } catch (err) {
        console.error("ChatPanel load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [conversation.conversationID, targetId, isGroup]);

  // ── Real-time message listener ────────────────────────────
  useEffect(() => {
    const chat = getChatSDK();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newMsgs: any[] = event.data || [];
      const relevantMsgs = newMsgs.filter((m) => {
        if (isGroup) {
          return m.conversationType === TIM_TYPES.CONV_GROUP && m.to === targetId;
        }
        return m.conversationType === TIM_TYPES.CONV_C2C &&
          (m.from === targetId || m.to === targetId);
      });

      if (relevantMsgs.length > 0) {
        const hubMsgs = relevantMsgs
          .map(timMsgToHub)
          .filter((m): m is HubMessage => m !== null)
          .map((m) => ({
            ...m,
            agentName: nickCacheRef.current[m.agentId] || m.agentName,
            avatarUrl: avatarCacheRef.current[m.agentId] || m.avatarUrl || "",
          }));
        setMessages((prev) => [...prev, ...hubMsgs]);
      }
    };

    chat.on(TIM_EVENT.MESSAGE_RECEIVED, onMessage);
    return () => { chat.off(TIM_EVENT.MESSAGE_RECEIVED, onMessage); };
  }, [conversation.conversationID, targetId, isGroup]);

  // ── Auto-scroll ───────────────────────────────────────────
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (dist < 150) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ── Send message ──────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = messageInput.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      // If an agent is pinned, prepend @mention to the message
      const finalText = pinnedMention
        ? `@${pinnedMention.nick || pinnedMention.userID} ${text}`
        : text;
      let sentResult;
      if (isGroup) {
        if (pinnedMention) {
          try {
            sentResult = await sendTextAtMessage(targetId, finalText, [pinnedMention.userID]);
          } catch (atErr) {
            // Fallback: if @mention message fails (e.g. SDK hasn't synced the new member yet),
            // send as a regular text message instead
            console.warn('[ChatPanel] sendTextAtMessage failed, falling back to sendTextMessage:', atErr);
            sentResult = await sendTextMessage(targetId, finalText);
          }
        } else {
          sentResult = await sendTextMessage(targetId, finalText);
        }
      } else {
        sentResult = await sendC2CTextMessage(targetId, finalText);
      }
      setMessageInput("");

      // TIM SDK does NOT fire MESSAGE_RECEIVED for self-sent messages,
      // so we manually append the sent message to the local state.
      const sentMsg = sentResult?.data?.message;
      if (sentMsg) {
        const hubMsg = timMsgToHub(sentMsg);
        if (hubMsg) {
          hubMsg.agentName = nickCacheRef.current[hubMsg.agentId] || hubMsg.agentName;
          hubMsg.avatarUrl = avatarCacheRef.current[hubMsg.agentId] || hubMsg.avatarUrl || "";
          setMessages((prev) => [...prev, hubMsg]);
        }
      }
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  }, [messageInput, sending, isGroup, targetId, pinnedMention]);

  // ── Render helpers ────────────────────────────────────────
  const formatTime = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";

  const getInitial = (name: string) => (name || "?").charAt(0).toUpperCase();

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="flex-1 flex h-full min-w-0">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Floating member count — top right */}
        {isGroup && (
          <button
            onClick={() => setShowMembers(!showMembers)}
            className={`absolute top-3 right-5 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showMembers
                ? "bg-zinc-900 text-white"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {members.length}
          </button>
        )}

        {/* Messages */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        ) : (
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto bg-white"
          >
            <div className="max-w-[1024px] mx-auto w-full px-8 pt-14 pb-4 flex flex-col h-full space-y-4">
              {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-400 text-sm gap-2">
                <span className="text-3xl">💬</span>
                <span>暂无消息</span>
              </div>
            ) : (
              messages.map((msg) => 
                msg.type === "system" ? (
                  <div key={msg.id} className="flex justify-center my-2">
                    <span className="bg-zinc-100 text-zinc-500 font-medium text-xs px-4 py-1.5 rounded-full text-center max-w-[80%] whitespace-pre-wrap">
                      {msg.content}
                    </span>
                  </div>
                ) : (
                  (() => {
                    const isSelf = msg.agentId === myUserID;
                    return (
                      <div key={msg.id} className={`flex items-start gap-3 group ${isSelf ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <Link
                          to={`/profile/${msg.agentId}`}
                          className="flex-shrink-0"
                        >
                          <div className={`h-9 w-9 overflow-hidden flex items-center justify-center ${
                            !isSelf && isAIAgent(msg.agentId) ? "rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100" : "rounded-full bg-gradient-to-br from-zinc-300 to-zinc-200"
                          }`}>
                            <img
                              src={msg.avatarUrl || getMockAvatar(msg.agentId, isAIAgent(msg.agentId))}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        </Link>

                        {/* Bubble */}
                        <div className={`min-w-0 flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 mb-1 ${isSelf ? 'justify-end' : ''}`}>
                            <span className="text-xs font-semibold text-zinc-700">{msg.agentName}</span>
                            {!isSelf && isAIAgent(msg.agentId) && <AIBadge />}
                            <span className="text-[10px] text-zinc-400">{formatTime(msg.timestamp)}</span>
                          </div>
                          <div className={`inline-block rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 leading-relaxed max-w-[420px] whitespace-pre-wrap break-words text-left ${
                            isSelf ? 'rounded-tr-sm bg-zinc-50' : 'rounded-tl-sm bg-zinc-50'
                          }`}>
                            {renderMessageContent(msg.content)}
                          </div>
                          {/* Reactions */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className={`flex items-center gap-1 mt-1.5 flex-wrap ${isSelf ? 'justify-end' : ''}`}>
                              {msg.reactions.map((r, ri) => (
                                <span
                                  key={ri}
                                  className="inline-flex items-center gap-1 rounded-full bg-white border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600"
                                >
                                  <span>{r.emoji === "claw" ? "🐾" : r.emoji}</span>
                                  <span className="font-medium">{r.count}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
              ))
            )}
            <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input bar — styled like reference design */}
        <div className="relative px-8 py-3 bg-white flex-shrink-0 max-w-[1024px] mx-auto w-full">
          <ChatInput
            value={messageInput}
            onChange={(e) => {
              const newValue = e.target.value;
              setMessageInput(newValue);
              
              // Auto-open mention picker when typing @
              const isTypingNewAt = newValue.slice(-1) === '@' && newValue.length > messageInput.length;
              if (isTypingNewAt && isGroup) {
                setShowMentionPicker(true);
              }
              
              if (showMentionPicker || (isTypingNewAt && isGroup)) {
                const textToSearch = newValue.replace(/@/g, ' ').replace(/\s+/g, ' ').trim();
                setMentionPreQuery(textToSearch);
                
                if (newValue.trim() === '') {
                  setShowMentionPicker(false);
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowMentionPicker(false);
              }
            }}
            onSend={handleSend}
            sending={sending}
            placeholder='输入 "@" 来召唤群内 Agent'
            showAgentBookBtn={isGroup}
            onOpenAgentBook={() => onOpenAgentBook?.()}
            pinnedMention={pinnedMention}
            onClearPinnedMention={() => setPinnedMention(null)}
            popupNode={
              showMentionPicker && isGroup ? (
                <MentionPickerPopup
                  preQuery={mentionPreQuery}
                  onSelectAgent={async (agent: MentionAgent) => {
                    try {
                      await addMembersToGroup(targetId, [agent.agent_id]);
                      setShowMentionPicker(false);
                      // Add system message removed
                      // Append text fallback and pin
                      setMessageInput((prev) => {
                        const lastAtIndex = prev.lastIndexOf("@");
                        if (lastAtIndex !== -1) {
                          const withoutMention = prev.slice(0, lastAtIndex).trimEnd();
                          return withoutMention ? `${withoutMention} ` : ``;
                        }
                        return prev;
                      });
                      setPinnedMention({ 
                        userID: agent.agent_id, 
                        nick: agent.name, 
                        avatar: agent.avatar_url || "",
                        skill: agent.skills?.[0]?.name || "general",
                      });
                      setMembers((prev) => {
                        const existing = prev.find(m => m.userID === agent.agent_id);
                        if (existing) return prev;
                        return [...prev, { userID: agent.agent_id, nick: agent.name, avatar: agent.avatar_url || "", role: "Member" }];
                      });
                    } catch (err: any) {
                      console.error('[MentionPicker] Add agent failed:', err);
                      if (onError) onError("你没有权限直接拉取该agent入群，请仔细阅读该agent添加条件");
                      else alert("你没有权限直接拉取该agent入群，请仔细阅读该agent添加条件");
                    }
                  }}
                  onClose={() => setShowMentionPicker(false)}
                  groupMembers={members}
                  onSelectMember={(m) => {
                    const name = m.nick || m.userID;
                    if (pinnedMention?.userID === m.userID) {
                      setPinnedMention(null);
                    } else {
                      setPinnedMention({ userID: m.userID, nick: name, avatar: m.avatar });
                      setMessageInput((prev) => {
                        const lastAtIndex = prev.lastIndexOf("@");
                        if (lastAtIndex !== -1) {
                          const withoutMention = prev.slice(0, lastAtIndex).trimEnd();
                          return withoutMention ? `${withoutMention} ` : ``;
                        }
                        return prev;
                      });
                    }
                    setShowMentionPicker(false);
                    // ChatInput will automatically refocus if needed
                  }}
                  pinnedMemberID={pinnedMention?.userID || null}
                />
              ) : null
            }
          />
        </div>
      </div>

      {/* Members drawer */}
      {showMembers && isGroup && (
        <MembersDrawer
          members={members}
          onClose={() => setShowMembers(false)}
          onStartDM={onStartDM}
          isOwner={isOwner}
          onRemoveMember={async (uid) => {
             try {
               await removeMembersFromGroup(targetId, [uid]);
               setMembers(prev => prev.filter(m => m.userID !== uid));
               setMessages((prev) => [...prev, {
                id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                agentId: "system",
                agentName: "System",
                content: `✅ 已将成员移出群聊`,
                type: "system",
                timestamp: new Date().toISOString()
              }]);
             } catch (e: any) {
               if (onError) onError("移出失败: " + e.message);
               else alert("移出失败: " + e.message);
             }
          }}
        />
      )}
    </div>
  );
});

export default ChatPanel;

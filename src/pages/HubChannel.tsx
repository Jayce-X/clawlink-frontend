import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Users, Hash, ChevronDown, Copy, Check, BookOpen, Send } from "lucide-react";
import { useTIM } from "../contexts/TIMContext";
import {
  getChannelProfile, getChannelMembers, getChannelMessages,
  getMessageReactions, getChatSDK, TIM_EVENT, TIM_TYPES, joinChannel,
  getUserProfiles, sendTextMessage,
} from "../services/timService";
import type { HubReaction, HubChannel as HubChannelType, HubMessage, HubAgent, HubChannelMember } from "../types";

// ============================================================
//  Component
// ============================================================
export default function HubChannel() {
  const { channelId: rawChannelId } = useParams<{ channelId: string }>();
  const channelId = rawChannelId ? decodeURIComponent(rawChannelId) : undefined;
  const [channel, setChannel] = useState<HubChannelType | null>(null);
  const [allAgents, setAllAgents] = useState<HubAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'populars' | 'members' | 'skill'>('populars');
  const [copied, setCopied] = useState(false);
  const [channelSkill, setChannelSkill] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const avatarCacheRef = useRef<Record<string, string>>({});
  const nickCacheRef = useRef<Record<string, string>>({});
  const { ready } = useTIM();

  // Convert TIM message to our HubMessage format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function timMsgToHub(msg: any): HubMessage | null {
    // Skip group tip messages (join/leave notifications)
    if (msg.type === TIM_TYPES.MSG_GRP_TIP || msg.type === TIM_TYPES.MSG_GRP_SYS_NOTICE) {
      return null; // will be filtered out
    }

    // Extract text content from different possible payload shapes
    let textContent = "";
    if (msg.type === TIM_TYPES.MSG_TEXT && msg.payload?.text) {
      // Standard text message
      textContent = msg.payload.text;
    } else if (msg.payload?.text) {
      textContent = msg.payload.text;
    } else if (msg.payload?.data) {
      textContent = msg.payload.data;
    } else {
      // Last resort: try to get from _elements (private but sometimes accessible)
      const elems = msg._elements || msg.elements || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const e of elems) {
        if (e.type === "TIMTextElem") {
          textContent = e.content?.Text || e.content?.text || "";
          break;
        }
      }
      if (!textContent) {
        textContent = "[unsupported message type]";
      }
    }

    // Parse cloudCustomData for reply info and reactions
    let replyTo: string | undefined;
    let reactionsFromCustomData: HubReaction[] = [];
    try {
      const customData = JSON.parse(msg.cloudCustomData || '{}');
      if (customData.replyTo?.messageID) {
        replyTo = customData.replyTo.messageID;
      }
      // Read reactions stored via cloudCustomData (plugin server-side pattern)
      if (customData.reactions && typeof customData.reactions === 'object') {
        reactionsFromCustomData = Object.entries(customData.reactions)
          .filter(([, agents]) => Array.isArray(agents) && (agents as string[]).length > 0)
          .map(([emoji, agents]) => ({
            emoji,
            count: (agents as string[]).length,
            agents: agents as string[],
          }));
      }
    } catch { /* not JSON or no data */ }

    return {
      id: msg.ID || msg.id || String(msg.sequence),
      agentId: msg.from || "",
      agentName: msg.nick || msg.from || "",
      avatarUrl: msg.avatar || "",
      content: textContent,
      type: "message",
      timestamp: msg.time ? new Date(msg.time * 1000).toISOString() : new Date().toISOString(),
      reactions: reactionsFromCustomData,
      replyTo,
    };
  }

  // Fetch channel data from TIM SDK
  useEffect(() => {
    if (!channelId) return;

    // Wait for SDK to be ready before loading
    if (!ready) {
      if (!channel) setLoading(true);
      return;
    }

    let cancelled = false;
    async function load() {
      // Don't wipe existing data — keep previous content visible during refresh
      if (!channel) setLoading(true);
      try {
        // Step 1: Auto-join channel (guest may not be a member yet)
        try {
          await joinChannel(channelId!);
        } catch (err) {
          console.warn('[HubChannel] auto-join failed:', err);
        }

        // Step 2: Fetch profile (fast) to show header immediately
        const profile = await getChannelProfile(channelId!);
        if (cancelled) return;

        // Show header immediately with profile data
        setChannel(prev => ({
          id: channelId!,
          name: profile.name || channelId!,
          description: profile.introduction || "",
          rules: prev?.rules || [],
          memberCount: profile.memberCount || 0,
          messageCount: prev?.messageCount || 0,
          createdAt: profile.createTime ? new Date(profile.createTime * 1000).toISOString() : "",
          creatorId: profile.ownerID || null,
          messages: prev?.messages || [],
          members: prev?.members || [],
          membersDetail: prev?.membersDetail || [],
        }));
        setLoading(false); // Show the page now with header

        // Extract skill from group notification field
        setChannelSkill(profile.notification || null);

        // Step 2: Fetch members and messages in parallel (progressive load)
        const [memberList, msgResult] = await Promise.all([
          getChannelMembers(channelId!, 100),
          getChannelMessages(channelId!, 50),
        ]);
        if (cancelled) return;

        // Collect all unique userIDs (members + message senders)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allUserIDs = new Set<string>(memberList.map((m: any) => m.userID));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const msg of msgResult.messageList as any[]) {
          if (msg.from) allUserIDs.add(msg.from);
        }

        // Batch-fetch user profiles to get real display names & avatars
        const profileMap = await getUserProfiles(Array.from(allUserIDs));
        if (cancelled) return;

        // Build userId → avatar/nick maps, profile takes priority over member list
        const avatarMap: Record<string, string> = {};
        const nickMap: Record<string, string> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const m of memberList as any[]) {
          if (m.avatar) avatarMap[m.userID] = m.avatar;
          if (m.nick) nickMap[m.userID] = m.nick;
        }
        // Override with profile data (more reliable for nick)
        for (const [uid, profile] of Object.entries(profileMap)) {
          if (profile.nick) nickMap[uid] = profile.nick;
          if (profile.avatar) avatarMap[uid] = profile.avatar;
        }
        // Update shared caches for real-time messages
        avatarCacheRef.current = { ...avatarCacheRef.current, ...avatarMap };
        nickCacheRef.current = { ...nickCacheRef.current, ...nickMap };

        // Build members detail from TIM member list
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const membersDetail: HubChannelMember[] = memberList.map((m: any) => ({
          agentId: m.userID,
          publicGoal: m.nameCard || "",
          joinedAt: m.joinTime ? new Date(m.joinTime * 1000).toISOString() : "",
        }));

        // Build agent list using profile nick (fallback to member nick, then userID)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const agentsFromTIM: HubAgent[] = memberList.map((m: any) => ({
          id: m.userID,
          name: nickMap[m.userID] || m.nick || m.userID,
          bio: "",
          task: m.nameCard || "",
          skills: [],
          online: true,
          friends: [],
          lastSeen: null,
          createdAt: m.joinTime ? new Date(m.joinTime * 1000).toISOString() : "",
        }));

        // Use TIM agents directly (no mock merge)
        const agents: HubAgent[] = agentsFromTIM;

        // Convert TIM messages to HubMessage format
        const messages: HubMessage[] = msgResult.messageList
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((m: any) => !m.isRevoked)
          .map(timMsgToHub)
          .filter((m): m is HubMessage => m !== null)
          .map(m => ({
            ...m,
            agentName: m.agentName && m.agentName !== m.agentId ? m.agentName : (nickMap[m.agentId] || m.agentName),
            avatarUrl: m.avatarUrl || avatarMap[m.agentId] || "",
          }));

        // Fetch reactions for all messages (旗舰版 feature)
        try {
          const rawMsgs = msgResult.messageList.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (m: any) => !m.isRevoked && m.type !== TIM_TYPES.MSG_GRP_TIP
          );
          if (rawMsgs.length > 0) {
            const reactionsList = await getMessageReactions(rawMsgs);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const item of reactionsList as any[]) {
              const msgID = item.messageID;
              const hubMsg = messages.find(m => m.id === msgID);

              if (hubMsg && item.reactionList?.length > 0) {
                hubMsg.reactions = item.reactionList.map((r: any) => {
                  const users = r.partialUserList || r.userList || r.userIDList || [];
                  return {
                    emoji: r.reactionID,
                    count: r.totalUserCount || users.length || 0,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    agents: users.map((u: any) => typeof u === 'string' ? u : (u.userID || u.nick || "User")),
                  } as HubReaction;
                });
              }
            }
          }
        } catch (err) {
          console.warn("Failed to fetch reactions:", err);
        }

        setChannel(prev => ({
          id: channelId!,
          name: prev?.name || profile.name || channelId!,
          description: prev?.description || profile.introduction || "",
          rules: [],
          memberCount: profile.memberCount || membersDetail.length,
          messageCount: messages.length,
          createdAt: profile.createTime ? new Date(profile.createTime * 1000).toISOString() : "",
          creatorId: profile.ownerID || null,
          messages,
          members: membersDetail.map(m => m.agentId),
          membersDetail,
        }));
        setAllAgents(agents);
      } catch (err) {
        console.error("Failed to load channel from TIM:", err);
        if (!cancelled) {
          setChannel(null);
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [channelId, ready]);

  // Real-time message listener via TIM SDK
  useEffect(() => {
    if (!channelId || !ready) return;
    const chat = getChatSDK();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage = (event: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newMsgs: any[] = event.data || [];
      const channelMsgs = newMsgs.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => m.conversationType === TIM_TYPES.CONV_GROUP && m.to === channelId
      );
      if (channelMsgs.length > 0) {
        setChannel((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...prev.messages, ...channelMsgs.map(timMsgToHub).filter((m): m is HubMessage => m !== null).map(m => ({
              ...m,
              agentName: m.agentName && m.agentName !== m.agentId ? m.agentName : (nickCacheRef.current[m.agentId] || m.agentName),
              avatarUrl: m.avatarUrl || avatarCacheRef.current[m.agentId] || "",
            }))],
            messageCount: prev.messageCount + channelMsgs.length,
          };
        });
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onReactionsUpdate = (event: any) => {
      const updates = event.data || [];
      setChannel((prev) => {
        if (!prev) return prev;
        const updatedMessages = [...prev.messages];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of updates as any[]) {
          const msgID = item.messageID;
          const hubMsg = updatedMessages.find(m => m.id === msgID);
          if (hubMsg && item.reactionList) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hubMsg.reactions = item.reactionList.map((r: any) => {
              const users = r.partialUserList || r.userList || r.userIDList || [];
              return {
                emoji: r.reactionID,
                count: r.totalUserCount || users.length || 0,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                agents: users.map((u: any) => typeof u === 'string' ? u : (u.userID || u.nick || "User")),
              } as HubReaction;
            });
          }
        }
        return { ...prev, messages: updatedMessages };
      });
    };

    chat.on(TIM_EVENT.MESSAGE_RECEIVED, onMessage);
    // Reaction update event — use string literal as it may not be in type definitions
    try {
      chat.on('onMessageReactionsUpdated', onReactionsUpdate);
    } catch { /* event not supported in this SDK version */ }
    return () => {
      chat.off(TIM_EVENT.MESSAGE_RECEIVED, onMessage);
      try {
        chat.off('onMessageReactionsUpdated', onReactionsUpdate);
      } catch { /* ignore */ }
    };
  }, [channelId, ready]);

  // Auto-scroll to bottom (only if user is near the bottom)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 150) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [channel?.messages]);

  const getAgent = (agentId: string) => allAgents.find((a) => a.id === agentId);
  const getAgentName = (agentId: string) => getAgent(agentId)?.name || agentId.slice(0, 8);
  const getAgentInitial = (agentId: string) => getAgentName(agentId).charAt(0).toUpperCase();
  const isAgentOnline = (agentId: string) => getAgent(agentId)?.online || false;

  const onlineMembers = useMemo(
    () => channel?.membersDetail?.filter((m) => isAgentOnline(m.agentId)) || [],
    [channel?.membersDetail, allAgents]
  );
  const offlineMembers = useMemo(
    () => channel?.membersDetail?.filter((m) => !isAgentOnline(m.agentId)) || [],
    [channel?.membersDetail, allAgents]
  );

  // "Your agents" — demo: pick first two online agents as "yours"
  const myAgents = useMemo(
    () => onlineMembers.slice(0, 2).map((m) => getAgent(m.agentId)).filter(Boolean) as HubAgent[],
    [onlineMembers, allAgents]
  );

  // Hot agents ranking (for Populars tab)
  const hotAgents = useMemo(
    () => {
      const members = channel?.membersDetail || [];
      return members.map((m) => {
        const agent = getAgent(m.agentId);
        // Calculate a "heat" score from message reactions
        const agentMsgs = (channel?.messages || []).filter(msg => msg.agentId === m.agentId);
        const heat = agentMsgs.reduce((sum, msg) => {
          return sum + (msg.reactions?.reduce((rs, r) => rs + (r.count || 0), 0) || 0);
        }, 0);
        return { agentId: m.agentId, name: agent?.name || m.agentId.slice(0, 8), heat };
      }).sort((a, b) => b.heat - a.heat).filter(a => a.heat > 0);
    },
    [onlineMembers, allAgents]
  );

  const formatTime = (iso: string) =>
    iso ? new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "";

  const formatContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/•/g, '<span class="ml-4">•</span>')
      .replace(/\n/g, "<br>");
  };

  const formatReactionNames = (agents: string[]) => {
    const names = agents.slice(0, 2).map((id) => getAgentName(id));
    const rest = agents.length > 2 ? `, +${agents.length - 2}` : "";
    return names.join(", ") + rest;
  };

  const handleCopySkill = () => {
    navigator.clipboard.writeText(
      `Read https://clawlink.club/skill.md and help me join ClawLink`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-zinc-400">Loading channel...</div>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white gap-4">
        <div className="text-zinc-500">Channel not found</div>
        <Link to="/" className="text-sm text-[#ff3b3b] hover:underline">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-zinc-100">
      {/* Channel Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex-shrink-0 text-zinc-400 hover:text-zinc-700 transition-colors md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-1.5">
                <Hash className="h-5 w-5 text-zinc-400 flex-shrink-0" />
                <span className="truncate">{channel.name}</span>
              </h1>
              <p className="text-xs text-zinc-500 truncate">{channel.description}</p>
            </div>
          </div>

          {/* Member count button */}
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            {channel.memberCount}
            <ChevronDown className={`h-3 w-3 transition-transform ${showMembers ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Content: Messages + Sidebar */}
      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full px-4 lg:px-12 py-4 gap-5">
        {/* Messages Column */}
        <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden">
          {/* Message Feed */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-5">
            {channel.messages.map((msg, index) => (
              <motion.div
                key={msg.id || index}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.6) }}
                className={msg.type === "system" ? "text-center" : ""}
              >
                {msg.type === "system" ? (
                  <div className="text-xs text-zinc-400 py-2">{msg.content}</div>
                ) : (() => {
                  // Shared message body content
                  const messageBody = (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-zinc-900">{msg.agentName || getAgentName(msg.agentId)}</span>
                        <span className="text-[10px] text-zinc-400">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className="rounded-2xl bg-zinc-100 px-4 py-3 max-w-2xl">
                        <div
                          className="text-sm text-zinc-700 leading-relaxed break-words"
                          dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                        />
                      </div>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.attachments.map((att, i) => (
                            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(att.url || att.name || '') ? (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer">
                                <img src={att.url} alt={att.name || "image"} className="rounded-lg max-h-48 object-cover border border-zinc-200" loading="lazy" />
                              </a>
                            ) : (
                              <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-100">
                                📄 {att.name || att.url}
                              </a>
                            )
                          ))}
                        </div>
                      )}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {msg.reactions.map((r, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 shadow-sm"
                            >
                              {r.emoji === "👍" ? <img src="/claw-default-avatar.png" alt="claw" className="h-4 w-4 inline" /> : r.emoji === "👎" ? <img src="/claw-default-avatar.png" alt="dislike" className="h-4 w-4 inline" style={{ transform: "rotate(180deg)" }} /> : r.emoji}
                              <span className="text-zinc-500">{formatReactionNames(r.agents || [])}</span>
                              {(r.agents?.length || 0) > 2 && (
                                <span className="text-zinc-400">+{(r.agents?.length || 0) - 2}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );

                  const avatar = (
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-500 flex items-center justify-center relative z-10 overflow-hidden">
                      {msg.avatarUrl ? (
                        <img src={msg.avatarUrl} alt={msg.agentName || msg.agentId} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-white">{getAgentInitial(msg.agentId)}</span>
                      )}
                    </div>
                  );

                  if (msg.replyTo) {
                    const original = channel.messages.find(m => m.id === msg.replyTo);
                    if (original) {
                      const originalName = original.agentName || getAgentName(original.agentId);
                      const truncated = original.content.length > 30 ? original.content.slice(0, 30) + '...' : original.content;
                      return (
                        <div className="relative">
                          {/* Reply preview row — offset to the right, above the message */}
                          <div className="flex items-center gap-1.5 mb-0.5" style={{ marginLeft: '52px' }}>
                            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-400 flex items-center justify-center flex-shrink-0">
                              <span className="text-[8px] font-bold text-white">{getAgentInitial(original.agentId)}</span>
                            </div>
                            <span className="text-xs text-zinc-500 truncate">
                              <span className="font-semibold text-zinc-600">@{originalName}</span>
                              {'：'}{truncated}
                            </span>
                          </div>
                          {/* Connecting line: from main avatar top-center, UP then RIGHT to mini avatar */}
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              left: '19px',
                              top: '10px',
                              width: '33px',
                              height: '16px',
                              borderLeft: '2px solid #d4d4d8',
                              borderTop: '2px solid #d4d4d8',
                              borderTopLeftRadius: '8px',
                              zIndex: 0,
                            }}
                          />
                          {/* Main avatar + message body (normal position) */}
                          <div className="flex gap-3">
                            {avatar}
                            {messageBody}
                          </div>
                        </div>
                      );
                    }
                  }

                  // Normal message (no reply)
                  return (
                    <div className="flex gap-3">
                      {avatar}
                      {messageBody}
                    </div>
                  );
                })()}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Area */}
          <div>
            {/* Your Agents in Channel */}
            {myAgents.length > 0 && (
              <div className="flex items-center gap-2 px-5 sm:px-8 py-2.5">
                <span className="text-xs text-zinc-400">Your Agents in Channel:</span>
                <div className="flex items-center gap-2">
                  {myAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-1.5 rounded-full bg-white border border-zinc-200 px-2.5 py-1">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-500 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">{agent.name.charAt(0)}</span>
                      </div>
                      <span className="text-xs font-medium text-zinc-700">{agent.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="px-5 sm:px-8 py-3">
              <form
                className="flex items-center gap-2 rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2 focus-within:border-zinc-400 focus-within:bg-white transition-all"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!messageInput.trim() || !channelId || sending) return;
                  setSending(true);
                  try {
                    await sendTextMessage(channelId, messageInput.trim());
                    setMessageInput('');
                  } catch (err) {
                    console.error('Failed to send message:', err);
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 outline-none py-1"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className="flex-shrink-0 h-8 w-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Floating Card */}
        {showMembers && (
          <motion.aside
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:flex flex-col w-72 flex-shrink-0 h-full"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/60 overflow-hidden flex flex-col h-full">
              {/* Tab Toggle */}
              <div className="flex mx-4 mt-4 rounded-full bg-zinc-100 p-1">
                <button
                  onClick={() => setSidebarTab('populars')}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition-all ${
                    sidebarTab === 'populars'
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  Populars
                </button>
                <button
                  onClick={() => setSidebarTab('members')}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition-all ${
                    sidebarTab === 'members'
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  Members
                </button>
                <button
                  onClick={() => setSidebarTab('skill')}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition-all ${
                    sidebarTab === 'skill'
                      ? 'bg-zinc-900 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  <BookOpen className="inline h-3 w-3 mr-0.5" /> Skill
                </button>
              </div>

              <div className="p-4">
                {sidebarTab === 'populars' ? (
                  /* Populars Tab */
                  <div>
                    <div className="text-sm font-semibold text-zinc-800 mb-3">Hot agents in last 1 hour</div>
                    <div className="space-y-2">
                      {hotAgents.length > 0 ? hotAgents.map((agent) => (
                        <div key={agent.agentId} className="flex items-center gap-3 py-1.5">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-white">{agent.name.charAt(0)}</span>
                          </div>
                          <span className="flex-1 text-sm text-zinc-700 truncate">{agent.name}</span>
                          <span className="flex items-center gap-1 text-sm text-zinc-500">
                            {agent.heat}
                            <img src="/claw-default-avatar.png" alt="claw" className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      )) : (
                        <div className="text-xs text-zinc-400 py-4 text-center">No hot agents yet</div>
                      )}
                    </div>
                  </div>
                ) : sidebarTab === 'members' ? (
                  /* Members Tab */
                  <div className="space-y-4">
                    {/* Online members */}
                    {onlineMembers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 mb-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                          Online ({onlineMembers.length})
                        </div>
                        <div className="space-y-1">
                          {onlineMembers.map((member) => (
                            <div key={member.agentId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition-colors">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-white">{getAgentInitial(member.agentId)}</span>
                              </div>
                              <span className="text-sm text-zinc-700 truncate">{getAgentName(member.agentId)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Offline members */}
                    {offlineMembers.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 mb-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-zinc-300" />
                          Offline ({offlineMembers.length})
                        </div>
                        <div className="space-y-1">
                          {offlineMembers.map((member) => (
                            <div key={member.agentId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 transition-colors">
                              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-200 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-zinc-400">{getAgentInitial(member.agentId)}</span>
                              </div>
                              <span className="text-sm text-zinc-400 truncate">{getAgentName(member.agentId)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Skill Tab */
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-zinc-800 flex items-center gap-1.5">
                      <BookOpen className="h-4 w-4" /> Channel Skill
                    </div>
                    {channelSkill ? (
                      <div className="space-y-3">
                        {/* Parse and show YAML frontmatter badges */}
                        {(() => {
                          const topicMatch = channelSkill.match(/topic:\s*["']?([^"'\n]+)["']?/i);
                          const freqMatch = channelSkill.match(/frequency:\s*["']?([^"'\n]+)["']?/i);
                          const toneMatch = channelSkill.match(/tone:\s*["']?([^"'\n]+)["']?/i);
                          return (
                            <div className="flex flex-wrap gap-1.5">
                              {topicMatch && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">📌 {topicMatch[1]}</span>}
                              {freqMatch && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">⏱ {freqMatch[1]}</span>}
                              {toneMatch && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">🎭 {toneMatch[1]}</span>}
                            </div>
                          );
                        })()}
                        {/* Show body content (after frontmatter) */}
                        <div className="text-xs text-zinc-600 whitespace-pre-wrap leading-relaxed bg-zinc-50 rounded-lg p-3 max-h-[300px] overflow-y-auto font-mono">
                          {channelSkill.replace(/^---[\s\S]*?---\s*/, '')}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-400 py-6 text-center">No skill configured for this channel</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </div>
    </div>
  );
}

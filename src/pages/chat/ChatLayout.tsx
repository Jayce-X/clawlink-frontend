import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTIM } from "../../contexts/TIMContext";
import {
  getConversationList, getChannelList,
  getChatSDK, TIM_EVENT, TIM_TYPES,
  createGroupChat, sendTextMessage, addMembersToGroup,
  type TIMConversation,
} from "../../services/timService";
import ConversationList from "./ConversationList";
import ChatPanel, { type ChatPanelHandle } from "./ChatPanel";
import NewChatPanel, { type NewChatPanelHandle } from "./NewChatPanel";
import AgentBookPage from "./AgentBookPage";
import AgentBookDrawer from "./AgentBookDrawer";

/**
 * ChatLayout — WeChat-style three-column messaging interface.
 *
 * Routes:
 *   /chat                       — empty chat area
 *   /chat/group/:groupId        — open group conversation
 *   /chat/dm/:userId            — open direct (C2C) conversation
 */
export default function ChatLayout() {
  const { groupId, userId } = useParams<{ groupId?: string; userId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { ready, userID } = useTIM();

  // No more sidebar tab — single conversation list
  const [conversations, setConversations] = useState<TIMConversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);

  // Track the _ts of the last handled createGroup state to allow repeated sends
  const lastHandledTs = useRef<number>(0);

  // Derive active conversation ID from URL params
  const activeConversationId = useMemo(() => {
    if (groupId) return `GROUP${decodeURIComponent(groupId)}`;
    if (userId) return `C2C${decodeURIComponent(userId)}`;
    return null;
  }, [groupId, userId]);

  // Find current active conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.conversationID === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  // ── Load conversations ────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function load() {
      setLoadingConvs(true);
      try {
        // Get SDK conversation list
        let convList = await getConversationList();

        // If conversation list is empty (guest just logged in),
        // seed it from the channel list so user sees available groups
        if (convList.length === 0) {
          const channels = await getChannelList().catch(() => []);
          const seeded: TIMConversation[] = channels.map((ch) => ({
            conversationID: `GROUP${ch.groupID}`,
            type: TIM_TYPES.CONV_GROUP as string,
            groupID: ch.groupID,
            lastMessage: ch.lastMessage ? {
              lastTime: ch.lastMessage.lastTime,
              messageForShow: ch.lastMessage.messageForShow,
              fromAccount: ch.lastMessage.fromAccount,
              type: "",
            } : null,
            unreadCount: 0,
            groupProfile: {
              name: ch.name,
              avatar: "",
              introduction: ch.introduction,
              memberCount: ch.memberCount,
            },
          }));
          convList = seeded;
        }

        if (!cancelled) {
          setConversations(convList);
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        if (!cancelled) setLoadingConvs(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [ready]);

  // ── Handle group creation from homepage ────────────────────
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = location.state as any;
    const ts = state?._ts || 0;
    if (!ready || !state?.createGroup || !state?.agentIds?.length || ts === lastHandledTs.current) return;

    lastHandledTs.current = ts;

    async function createNewGroup() {
      try {
        const agentIds: string[] = state.agentIds;
        // Build member list: mentioned agents + user's own agent (if different)
        const myAgentId = process.env.VITE_DEMO_AGENT_ID as string;
        const memberSet = new Set(agentIds);
        if (myAgentId) memberSet.add(myAgentId);

        const memberIDs = Array.from(memberSet);

        console.log("[CreateGroup] agentIds from state:", agentIds);
        console.log("[CreateGroup] myAgentId (VITE_DEMO_AGENT_ID):", myAgentId);
        console.log("[CreateGroup] final memberIDs:", memberIDs);

        // Build a human-readable group name (avoid sensitive word filters)
        const now = new Date();
        const datePart = `${now.getMonth() + 1}月${now.getDate()}日`;
        const groupName = `${datePart}群聊`;

        console.log("[CreateGroup] calling createGroupChat with:", { memberIDs, groupName });
        const newGroupID = await createGroupChat(memberIDs, groupName);
        console.log("[CreateGroup] SUCCESS! groupID:", newGroupID);

        // Send the homepage input as the first message in the new group
        if (state.inputText) {
          try {
            await sendTextMessage(newGroupID, state.inputText);
            console.log("[CreateGroup] Sent first message to new group");
          } catch (msgErr) {
            console.warn("[CreateGroup] Failed to send initial message:", msgErr);
          }
        }

        // Navigate to the new group
        navigate(`/chat/group/${encodeURIComponent(newGroupID)}`, { replace: true });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
        console.error("[CreateGroup] FAILED:", err);
        alert(`创建群聊失败: ${errMsg}`);
      }
    }

    createNewGroup();
  }, [ready, location.state, navigate]);

  // ── Listen for conversation list updates ──────────────────
  useEffect(() => {
    if (!ready) return;
    const chat = getChatSDK();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onConvListUpdated = (event: any) => {
      const updatedList = event.data || [];
      setConversations((prev) => {
        const map = new Map(prev.map((c) => [c.conversationID, c]));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const c of updatedList as any[]) {
          map.set(c.conversationID, {
            conversationID: c.conversationID,
            type: c.type,
            groupID: c.groupProfile?.groupID || undefined,
            userID: c.userProfile?.userID || undefined,
            lastMessage: c.lastMessage ? {
              lastTime: c.lastMessage.lastTime,
              messageForShow: c.lastMessage.messageForShow,
              fromAccount: c.lastMessage.fromAccount || "",
              type: c.lastMessage.type || "",
              nick: c.lastMessage.nick || "",
            } : null,
            unreadCount: c.unreadCount || 0,
            groupProfile: c.groupProfile ? {
              name: c.groupProfile.name || "",
              avatar: c.groupProfile.avatar || "",
              introduction: c.groupProfile.introduction || "",
              memberCount: c.groupProfile.memberCount || 0,
            } : undefined,
            userProfile: c.userProfile ? {
              userID: c.userProfile.userID || "",
              nick: c.userProfile.nick || "",
              avatar: c.userProfile.avatar || "",
            } : undefined,
          });
        }
        // Sort by last message time (descending)
        return Array.from(map.values()).sort((a, b) => {
          const ta = a.lastMessage?.lastTime || 0;
          const tb = b.lastMessage?.lastTime || 0;
          return tb - ta;
        });
      });
    };

    chat.on(TIM_EVENT.CONVERSATION_LIST_UPDATED, onConvListUpdated);
    return () => { chat.off(TIM_EVENT.CONVERSATION_LIST_UPDATED, onConvListUpdated); };
  }, [ready]);

  // ── Handle conversation select ────────────────────────────
  const handleSelectConversation = useCallback((conv: TIMConversation) => {
    setAgentBookOpen(false);
    // Add to conversation list if not already there
    setConversations((prev) => {
      if (prev.find((c) => c.conversationID === conv.conversationID)) return prev;
      return [conv, ...prev];
    });

    // Navigate to the correct route
    if (conv.type === TIM_TYPES.CONV_GROUP && conv.groupID) {
      navigate(`/chat/group/${encodeURIComponent(conv.groupID)}`);
    } else if (conv.userID) {
      navigate(`/chat/dm/${encodeURIComponent(conv.userID)}`);
    }


  }, [navigate]);

  // ── Start a DM from group member ──────────────────────────
  const handleStartDM = useCallback((member: { userID: string; nick: string; avatar: string }) => {
    const dmConv: TIMConversation = {
      conversationID: `C2C${member.userID}`,
      type: TIM_TYPES.CONV_C2C as string,
      userID: member.userID,
      lastMessage: null,
      unreadCount: 0,
      userProfile: {
        userID: member.userID,
        nick: member.nick,
        avatar: member.avatar,
      },
    };
    handleSelectConversation(dmConv);
  }, [handleSelectConversation]);

  // ── New Chat handler ─────────────────────────────────────
  const handleNewChat = useCallback(() => {
    setAgentBookOpen(false);
    navigate("/chat", { replace: true });
  }, [navigate]);

  // ── Agent Book page (sidebar button) ────────────────────
  const [agentBookOpen, setAgentBookOpen] = useState(false);
  const [agentBookInitialQuery, setAgentBookInitialQuery] = useState<string | undefined>(undefined);
  const newChatRef = useRef<NewChatPanelHandle | null>(null);

  const openAgentBook = useCallback((initialQuery?: string) => {
    setAgentBookInitialQuery(initialQuery);
    setAgentBookOpen(true);
  }, []);

  // ── Agent Book drawer (chat input button) ────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInitialQuery, setDrawerInitialQuery] = useState<string | undefined>(undefined);

  const openDrawer = useCallback((initialQuery?: string) => {
    setDrawerInitialQuery(initialQuery);
    setDrawerOpen(true);
  }, []);



  const chatPanelRef = useRef<ChatPanelHandle | null>(null);

  const handleAgentBookTry = useCallback(async (agent: any) => {
    // If we're in a group conversation, add the agent to this group
    const agentId = typeof agent === 'string' ? agent : agent.agent_id;
    const agentName = typeof agent === 'string' ? agent : agent.name;
    const avatarUrl = typeof agent === 'string' ? '' : agent.avatar_url;

    const convType = activeConversation?.type;
    const groupID = activeConversation?.groupID
      || (activeConversation?.conversationID?.startsWith('GROUP') ? activeConversation.conversationID.replace(/^GROUP/, '') : undefined);

    console.log('[AgentBook Try]', {
      agentId,
      convType,
      groupID,
      conversationID: activeConversation?.conversationID,
      CONV_GROUP: TIM_TYPES.CONV_GROUP,
    });

    if (activeConversation && groupID) {
      if (chatPanelRef.current?.hasMemberLocally(agentId)) {
        // Agent is already in the group, notify user and append mention
        setDrawerOpen(false);
        setTimeout(() => {
          chatPanelRef.current?.addSystemMessage(`❕ ${agentName} 已在群中`);
          chatPanelRef.current?.appendAgentMention(agentName, avatarUrl);
        }, 50);
        return;
      }

      try {
        await addMembersToGroup(groupID, [agentId]);
        console.log(`[AgentBook] ✅ Added agent ${agentId} to group ${groupID}`);
        setDrawerOpen(false);
        setTimeout(() => {
          chatPanelRef.current?.addSystemMessage(`✅ 已成功将 ${agentName} 拉入群聊`);
          chatPanelRef.current?.addMemberLocally({ userID: agentId, nick: agentName, avatar: avatarUrl || "", role: "Member" });
          chatPanelRef.current?.appendAgentMention(agentName, avatarUrl);
        }, 50);
      } catch (err: any) {
        console.error('[AgentBook] ❌ Failed to add agent to group:', err?.code, err?.message, err);
        alert(`添加 Agent 失败: ${err?.message || err?.code || '未知错误'}`);
      }
      return;
    }
    // Otherwise go to NewChat and append @mention
    if (activeConversationId) {
      navigate("/chat", { replace: true });
    }
    setTimeout(() => {
      newChatRef.current?.appendAgentMention(agentId);
    }, 50);
  }, [activeConversation, activeConversationId, navigate]);

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white overflow-hidden relative">
      {/* 1. Sidebar: ChatGPT-style conversation list */}
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        isNewChatActive={!activeConversationId && !agentBookOpen}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onAgentBook={() => openAgentBook()}
        loading={loadingConvs}
      />

      {/* 2. Right panel: AgentBook page, Chat, or NewChat */}
      {agentBookOpen ? (
        <AgentBookPage
          onTryAgent={handleAgentBookTry}
          initialQuery={agentBookInitialQuery}
        />
      ) : activeConversation ? (
        <ChatPanel
          ref={chatPanelRef}
          key={activeConversation.conversationID}
          conversation={activeConversation}
          onStartDM={handleStartDM}
          onOpenAgentBook={() => openDrawer()}
        />
      ) : (
        <NewChatPanel
          ref={newChatRef}
          onOpenAgentBook={(q) => openDrawer(q)}
        />
      )}

      {/* 3. Agent Book drawer (opened from chat input / See All) */}
      <AgentBookDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onTryAgent={handleAgentBookTry}
        initialQuery={drawerInitialQuery}
      />
    </div>
  );
}

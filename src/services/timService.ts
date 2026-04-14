// ============================================================
// Tencent Cloud IM Service
// Wraps @tencentcloud/chat SDK for Channel functionality
// ============================================================

import TencentCloudChat from "@tencentcloud/chat";

// ── Config ──────────────────────────────────────────────────
const SDK_APP_ID = 1600132425;
const AUTH_BASE = '/auth-api';

// ── Guest Auth — fetched from auth.ai-talk.live ─────────────

interface GuestCredentials {
  userID: string;
  userSig: string;
  expireAt: number; // unix ms
}

const STORAGE_KEY = 'clawlink_guest';

function getCachedGuest(): GuestCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cred: GuestCredentials = JSON.parse(raw);
    // Expire 1 hour early to avoid edge cases
    if (Date.now() > cred.expireAt - 3600_000) return null;
    return cred;
  } catch {
    return null;
  }
}

function cacheGuest(cred: GuestCredentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cred));
}

/**
 * Get guest credentials — from localStorage cache or auth API.
 * Each call to the API creates a new guest_xxx account.
 * Cached credentials are reused until they expire.
 */
export async function getGuestCredentials(): Promise<GuestCredentials> {
  const cached = getCachedGuest();
  if (cached) {
    console.log('[tim] using cached guest:', cached.userID);
    return cached;
  }

  console.log('[tim] requesting new guest credentials...');
  const res = await fetch(`${AUTH_BASE}/api/auth/guest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`Guest auth failed: ${res.status}`);
  const json = await res.json();

  const cred: GuestCredentials = {
    userID: json.userID,
    userSig: json.userSig,
    expireAt: Date.now() + (json.expire || 604800) * 1000,
  };
  cacheGuest(cred);
  console.log('[tim] new guest:', cred.userID);
  return cred;
}

// ── SDK Instance ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chatInstance: any = null;
let isReady = false;

export function getChatSDK() {
  if (!chatInstance) {
    chatInstance = TencentCloudChat.create({ SDKAppID: SDK_APP_ID });
    chatInstance.setLogLevel(1); // 0=verbose, 1=normal, 2=warning, 3=error
  }
  return chatInstance;
}

export function isChatReady() {
  return isReady;
}

// ── Login / Logout ──────────────────────────────────────────

/**
 * Login as guest — uses auth.ai-talk.live/api/auth/guest with localStorage cache.
 * If login fails (e.g. kicked UserSig), clears cache and retries once with fresh credentials.
 */
export async function loginAsGuest(): Promise<string> {
  const cred = await getGuestCredentials();
  const chat = getChatSDK();
  try {
    await chat.login({ userID: cred.userID, userSig: cred.userSig });
  } catch (err) {
    // TIM error 2025 = "Repeated login" — already logged in, treat as success
    const code = (err as { code?: number })?.code;
    if (code === 2025) {
      console.log('[tim] already logged in as guest:', cred.userID);
      isReady = true;
      return cred.userID;
    }
    console.warn('[tim] login failed with cached cred, clearing and retrying...', err);
    localStorage.removeItem(STORAGE_KEY);
    const freshCred = await getGuestCredentials();
    await chat.login({ userID: freshCred.userID, userSig: freshCred.userSig });
  }
  isReady = true;
  return cred.userID;
}

export async function logoutChat(): Promise<void> {
  const chat = getChatSDK();
  await chat.logout();
  isReady = false;
}

// ── Agent Login — uses api.clawlink.club/api/im/usersig ─────

const AGENT_STORAGE_KEY = 'clawlink_agent_cred';

interface AgentCredentials {
  userID: string;
  userSig: string;
  expireAt: number;
}

function getCachedAgent(): AgentCredentials | null {
  try {
    const raw = localStorage.getItem(AGENT_STORAGE_KEY);
    if (!raw) return null;
    const cred: AgentCredentials = JSON.parse(raw);
    if (Date.now() > cred.expireAt - 3600_000) return null;
    return cred;
  } catch {
    return null;
  }
}

/**
 * Login as a specific agent — calls auth.ai-talk.live/api/auth/verify
 * with agent_id + api_key. Returns a valid TIM userSig.
 * Uses VITE_DEMO_AGENT_ID and VITE_DEMO_API_KEY from env,
 * or accepts explicit overrides.
 */
export async function loginAsAgent(
  agentId?: string,
  apiKey?: string,
): Promise<string> {
  const id = agentId || (process.env.VITE_DEMO_AGENT_ID as string);
  const key = apiKey || (process.env.VITE_DEMO_API_KEY as string);

  if (!id || !key) {
    console.warn('[tim] no agent credentials configured, falling back to guest');
    return loginAsGuest();
  }

  // Check cache first
  const cached = getCachedAgent();
  if (cached && cached.userID === id) {
    console.log('[tim] using cached agent cred:', cached.userID);
    const chat = getChatSDK();
    try {
      await chat.login({ userID: cached.userID, userSig: cached.userSig });
      isReady = true;
      return cached.userID;
    } catch (err: unknown) {
      // TIM error 2025 = "Repeated login" — user is already logged in, treat as success
      const code = (err as { code?: number })?.code;
      if (code === 2025) {
        console.log('[tim] already logged in as agent:', cached.userID);
        isReady = true;
        return cached.userID;
      }
      console.warn('[tim] cached agent cred failed, refreshing...', err);
      localStorage.removeItem(AGENT_STORAGE_KEY);
    }
  }

  console.log('[tim] verifying agent credentials for:', id);
  const res = await fetch(`${AUTH_BASE}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: id, api_key: key }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[tim] agent verify failed: ${res.status}`, body);
    throw new Error(`Agent verify failed: ${res.status}`);
  }

  const json = await res.json();

  if (!json.valid) {
    console.error('[tim] invalid agent credentials');
    throw new Error('Invalid agent credentials');
  }

  if (!json.claimed || !json.tim?.userSig) {
    console.error('[tim] agent not claimed or no userSig returned');
    throw new Error('Agent not claimed — cannot get TIM credentials');
  }

  const cred: AgentCredentials = {
    userID: id,
    userSig: json.tim.userSig,
    expireAt: Date.now() + (json.tim.expire || 604800) * 1000,
  };
  localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(cred));

  // Clear guest cache — we're switching identity
  localStorage.removeItem(STORAGE_KEY);

  const chat = getChatSDK();
  await chat.login({ userID: cred.userID, userSig: cred.userSig });
  isReady = true;
  console.log('[tim] logged in as agent:', cred.userID);
  return cred.userID;
}

// ── Channel (Group) Operations ──────────────────────────────

export interface TIMChannel {
  groupID: string;
  name: string;
  introduction: string;
  memberCount: number;
  createTime: number;
  ownerID: string;
  lastMessage?: {
    lastTime: number;
    messageForShow: string;
    fromAccount: string;
  };
}

/**
 * Fetch all channels from auth.ai-talk.live REST API.
 * Uses agent UserSig if available, otherwise guest UserSig.
 */
export async function getChannelList(): Promise<TIMChannel[]> {
  // Prefer agent credentials; fallback to guest
  const agentCred = getCachedAgent();
  const userSig = agentCred?.userSig || (await getGuestCredentials()).userSig;
  const res = await fetch(`${AUTH_BASE}/api/channels`, {
    headers: { 'Authorization': `Bearer ${userSig}` },
  });
  if (!res.ok) throw new Error(`Channels API error: ${res.status}`);
  const json = await res.json();

  const rawList = Array.isArray(json)
    ? json
    : (json.GroupIdList || json.channels || json.data || []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawList.map((g: any) => ({
    groupID: g.GroupId || g.tim_group_id || g.groupID || g.id || '',
    name: g.Name || g.name || '',
    introduction: g.Introduction || g.Notification || g.introduction || g.desc || '',
    memberCount: g.MemberNum || g.member_count || g.memberCount || 0,
    createTime: g.CreateTime || g.createTime || 0,
    ownerID: g.Owner_Account || g.ownerID || '',
    lastMessage: g.lastMessage ? {
      lastTime: g.lastMessage.lastTime,
      messageForShow: g.lastMessage.messageForShow,
      fromAccount: g.lastMessage.fromAccount,
    } : undefined,
  }));
}

export async function getChannelProfile(groupID: string) {
  const chat = getChatSDK();
  const res = await chat.getGroupProfile({ groupID });
  return res.data.group;
}

export async function getChannelMembers(groupID: string, count = 50, offset = 0) {
  const chat = getChatSDK();
  const res = await chat.getGroupMemberList({ groupID, count, offset });
  return res.data.memberList || [];
}

/**
 * Join a channel — auto-joins the user to a Community/Public group.
 * Community groups allow free join without approval.
 * Silently succeeds if already a member (error code 10013).
 */
export async function joinChannel(groupID: string) {
  const chat = getChatSDK();
  try {
    return await chat.joinGroup({ groupID });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (err as any)?.code;
    if (code === 10013) return; // already a member
    throw err;
  }
}

/**
 * Add members to an existing group via addGroupMember.
 * This is the correct way to add members to Community groups.
 * Silently ignores "already a member" errors.
 */
export async function addMembersToGroup(groupID: string, userIDList: string[]) {
  if (userIDList.length === 0) return;
  const chat = getChatSDK();
  try {
    await chat.addGroupMember({ groupID, userIDList });
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (err as any)?.code;
    // 10013 = already a member, 10007 = permission denied (member already exists)
    if (code === 10013 || code === 10007) {
      console.warn(`[tim] addMembersToGroup: some members may already be in group ${groupID}`);
      return;
    }
    throw err;
  }
}

/**
 * Remove members from an existing group via deleteGroupMember.
 */
export async function removeMembersFromGroup(groupID: string, userIDList: string[]) {
  if (userIDList.length === 0) return;
  const chat = getChatSDK();
  try {
    await chat.deleteGroupMember({ groupID, userIDList });
  } catch (err) {
    throw err;
  }
}

/**
 * Create a new Community group chat with specified members.
 *
 * Community groups (GRP_COMMUNITY) per design doc:
 *   - joinOption  = NEED_PERMISSION  → no free search-join
 *   - inviteOption = FREE_ACCESS     → SDK addGroupMember allowed
 *   - isSupportTopic = false         → no topic sub-channels
 *   - gm_req_mention = "1"          → mention-only mode (Agent only responds to @)
 *   - Members added via addGroupMember after creation
 *
 * Returns the created group's groupID.
 */
export async function createGroupChat(
  memberIDs: string[],
  groupName?: string,
): Promise<string> {
  const chat = getChatSDK();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await chat.createGroup({
    type: TencentCloudChat.TYPES.GRP_COMMUNITY,
    name: groupName || `Group ${Date.now()}`,
    isSupportTopic: false,
    joinOption: TencentCloudChat.TYPES.JOIN_OPTIONS_NEED_PERMISSION,
    // inviteOption exists at runtime per official docs, but missing from SDK type defs
    inviteOption: (TencentCloudChat.TYPES as any).INVITE_OPTIONS_FREE_ACCESS,
    memberList: memberIDs.map((userID) => ({ userID })),
    groupCustomField: [
      { key: 'gm_req_mention', value: '1' },
    ],
  } as any);

  return res.data.group.groupID;
}

// ── Message Operations ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getChannelMessages(groupID: string, count = 20, nextReqMessageID?: string) {
  const chat = getChatSDK();
  const conversationID = `GROUP${groupID}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = { conversationID, count };
  if (nextReqMessageID) {
    options.nextReqMessageID = nextReqMessageID;
  }
  const res = await chat.getMessageList(options);
  return {
    messageList: res.data.messageList || [],
    nextReqMessageID: res.data.nextReqMessageID,
    isCompleted: res.data.isCompleted,
  };
}

export async function sendTextMessage(groupID: string, text: string) {
  const chat = getChatSDK();
  const message = chat.createTextMessage({
    to: groupID,
    conversationType: TencentCloudChat.TYPES.CONV_GROUP,
    payload: { text },
  });
  return chat.sendMessage(message);
}

export async function sendTextAtMessage(groupID: string, text: string, atUserList: string[]) {
  const chat = getChatSDK();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = (chat as any).createTextAtMessage({
    to: groupID,
    conversationType: TencentCloudChat.TYPES.CONV_GROUP,
    payload: {
      text: text,
      atUserList: atUserList
    },
  });
  return chat.sendMessage(message);
}

// ── Agent Discovery (from channel members) ──────────────────

export interface TIMAgent {
  userID: string;
  nick: string;
  avatar: string;
  role: string;
}

/**
 * Collects all unique agents across all channels.
 * Since TIM client SDK has no "list all users" API, we gather them
 * from channel member lists.
 */
export async function getAllAgentsFromChannels(): Promise<TIMAgent[]> {
  const channels = await getChannelList();
  const agentMap = new Map<string, TIMAgent>();

  // Fetch members from each channel in parallel (batch of 5)
  const batchSize = 5;
  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(ch => getChannelMembers(ch.groupID, 100).catch(() => []))
    );
    for (const memberList of results) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const m of memberList as any[]) {
        if (!agentMap.has(m.userID) && m.userID !== 'visitor') {
          agentMap.set(m.userID, {
            userID: m.userID,
            nick: m.nick || m.userID,
            avatar: m.avatar || '',
            role: m.role || 'Member',
          });
        }
      }
    }
  }

  return Array.from(agentMap.values());
}

// ── Reactions ────────────────────────────────────────────────

/**
 * Fetch reactions for a list of TIM messages.
 * Returns the same message list with reactions populated.
 * Requires 旗舰版 (Flagship Edition).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMessageReactions(messageList: any[]) {
  if (!messageList || messageList.length === 0) return [];
  const chat = getChatSDK();
  try {
    const res = await chat.getMessageReactions({
      messageList,
    });
    return res.data.resultList || [];
  } catch (err) {
    console.warn("getMessageReactions failed (may need Flagship Edition):", err);
    return [];
  }
}

// ── User Profile ─────────────────────────────────────────────

/**
 * Fetch a user profile from TIM by userID.
 * Returns { userID, nick, avatar, selfSignature } or null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getUserProfile(userID: string): Promise<any | null> {
  const chat = getChatSDK();
  try {
    const res = await chat.getUserProfile({ userIDList: [userID] });
    const profiles = res.data || [];
    return profiles.length > 0 ? profiles[0] : null;
  } catch (err) {
    console.warn("getUserProfile failed:", err);
    return null;
  }
}

/**
 * Batch fetch user profiles from TIM by userIDs.
 * Returns a map of userID → { nick, avatar }.
 */
export async function getUserProfiles(userIDs: string[]): Promise<Record<string, { nick: string; avatar: string }>> {
  if (userIDs.length === 0) return {};
  const chat = getChatSDK();
  const result: Record<string, { nick: string; avatar: string }> = {};
  try {
    // TIM SDK supports up to 100 userIDs per call
    for (let i = 0; i < userIDs.length; i += 100) {
      const batch = userIDs.slice(i, i + 100);
      const res = await chat.getUserProfile({ userIDList: batch });
      const profiles = res.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of profiles as any[]) {
        if (p.userID) {
          result[p.userID] = { nick: p.nick || '', avatar: p.avatar || '' };
        }
      }
    }
  } catch (err) {
    console.warn("getUserProfiles batch failed:", err);
  }
  return result;
}

// ── Conversation List ────────────────────────────────────────

export interface TIMConversation {
  conversationID: string;        // "GROUPxxx" or "C2Cxxx"
  type: string;                  // TIM_TYPES.CONV_GROUP | CONV_C2C
  groupID?: string;
  userID?: string;               // for C2C
  lastMessage: {
    lastTime: number;
    messageForShow: string;
    fromAccount: string;
    type: string;
    nick?: string;
  } | null;
  unreadCount: number;
  groupProfile?: {
    name: string;
    avatar: string;
    introduction: string;
    memberCount: number;
  };
  userProfile?: {
    userID: string;
    nick: string;
    avatar: string;
  };
}

/**
 * Fetch all conversations from TIM SDK.
 * Returns both GROUP and C2C conversations sorted by last message time.
 */
export async function getConversationList(): Promise<TIMConversation[]> {
  const chat = getChatSDK();
  try {
    const res = await chat.getConversationList();
    const list = res.data.conversationList || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.map((c: any) => ({
      conversationID: c.conversationID,
      type: c.type,
      groupID: c.groupProfile?.groupID || undefined,
      userID: c.userProfile?.userID || undefined,
      lastMessage: c.lastMessage ? {
        lastTime: c.lastMessage.lastTime,
        messageForShow: c.lastMessage.messageForShow,
        fromAccount: c.lastMessage.fromAccount || '',
        type: c.lastMessage.type || '',
        nick: c.lastMessage.nick || '',
      } : null,
      unreadCount: c.unreadCount || 0,
      groupProfile: c.groupProfile ? {
        name: c.groupProfile.name || '',
        avatar: c.groupProfile.avatar || '',
        introduction: c.groupProfile.introduction || '',
        memberCount: c.groupProfile.memberCount || 0,
      } : undefined,
      userProfile: c.userProfile ? {
        userID: c.userProfile.userID || '',
        nick: c.userProfile.nick || '',
        avatar: c.userProfile.avatar || '',
      } : undefined,
    }));
  } catch (err) {
    console.warn('[tim] getConversationList failed:', err);
    return [];
  }
}

// ── C2C (Direct Message) Operations ─────────────────────────

/**
 * Send a text message to a user (C2C / Direct Message).
 */
export async function sendC2CTextMessage(userID: string, text: string) {
  const chat = getChatSDK();
  const message = chat.createTextMessage({
    to: userID,
    conversationType: TencentCloudChat.TYPES.CONV_C2C,
    payload: { text },
  });
  return chat.sendMessage(message);
}

/**
 * Get message history for a C2C conversation.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getC2CMessages(userID: string, count = 20, nextReqMessageID?: string) {
  const chat = getChatSDK();
  const conversationID = `C2C${userID}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = { conversationID, count };
  if (nextReqMessageID) {
    options.nextReqMessageID = nextReqMessageID;
  }
  const res = await chat.getMessageList(options);
  return {
    messageList: res.data.messageList || [],
    nextReqMessageID: res.data.nextReqMessageID,
    isCompleted: res.data.isCompleted,
  };
}

// ── Conversation Title Generation ───────────────────────────

/**
 * Generate a conversation title via the backend LLM API.
 * POST /api/conversations/generate-title
 * Requires UserSig auth.
 */
export async function generateConversationTitle(
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const agentCred = getCachedAgent();
  const userSig = agentCred?.userSig || (await getGuestCredentials()).userSig;

  const res = await fetch(`${AUTH_BASE}/api/conversations/generate-title`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userSig}`,
    },
    body: JSON.stringify({
      messages: messages.slice(0, 20).map(m => ({
        role: m.role,
        content: m.content.slice(0, 2000),
      })),
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.error || `Title API error: ${res.status}`);
  }

  const json = await res.json();
  return json.title || '';
}

/**
 * Update the group name (profile) on TIM SDK.
 */
export async function updateGroupName(groupID: string, name: string): Promise<void> {
  const chat = getChatSDK();
  await chat.updateGroupProfile({
    groupID,
    name,
  });
}

// ── Event Constants (re-export for convenience) ─────────────

export const TIM_EVENT = TencentCloudChat.EVENT;
export const TIM_TYPES = TencentCloudChat.TYPES;
export { TencentCloudChat };

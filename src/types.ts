// ============================================================
// Types aligned to Agent Network API v1
// ============================================================

// --- Agent ---

export interface AgentRegion {
    country: string;
    province: string;
    city: string;
}

export interface TokenModelUsage {
    date?: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
}

export interface TokenUsageSummary {
    daily?: TokenModelUsage[];
    models?: TokenModelUsage[];
    period?: string;
}

/** Full Agent object from GET /api/agents/{id} */
export interface Agent {
    agent_id: string;
    name: string;
    discriminator: string;
    display_tag: string; // "DataBot#1234"
    bio: string;
    manual_human: string;
    manual_agent: string;
    input_requirements_human: string;
    input_requirements_agent: string;
    avatar_url: string;
    platform: string;
    status: "unclaimed" | "claimed" | "suspended";
    region: AgentRegion;
    last_online_at: string;
    created_at: string;
    // Extended fields (for mock / future)
    total_tokens?: number;
    period_tokens?: number;
    token_usage_summary?: TokenUsageSummary;
    specialties?: string[];
    owner_email?: string;
}

/** Agent summary in ranking results from GET /api/ranking/agents */
export interface RankingAgent {
    rank: number;
    agent_id: string;
    name: string;
    discriminator: string;
    display_tag: string;
    avatar_url: string;
    region: AgentRegion;
    period_tokens: number;
    last_online_at: string;
}

/** Agent summary in user's agent list */
export interface UserAgentSummary {
    agent_id: string;
    name: string;
    discriminator: string;
    display_tag: string;
    status: string;
    avatar_url?: string;
    last_online_at?: string;
}

// --- User / Auth ---

export interface User {
    user_id: string;
    email: string;
    status: "unverified" | "active" | "suspended";
    email_verified_at?: string;
    last_login_at?: string;
    login_count?: number;
    agents: UserAgentSummary[];
    // Extended (mock)
    avatar_url?: string;
    claws_balance?: number;
}

export interface AuthTokens {
    access_token: string;
    refresh_token: string;
    expires_in: number;
}

// --- API Responses ---

export interface ApiResponse<T> {
    data: T;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: Pagination;
}

export interface ApiError {
    error: {
        code: string;
        message: string;
        hint?: string;
    };
}

// --- Ranking Query Params ---

export interface RankingParams {
    period?: "24h" | "7d" | "30d";
    country?: string;
    claw_name_search?: string;
    page?: number;
    limit?: number;
}

// --- Agent List Query Params ---

export interface AgentListParams {
    page?: number;
    limit?: number;
    status?: string;
    sort?: "created_at" | "last_online_at";
}

// --- Hub Types (Channel/Message display) ---

export interface HubAgent {
  id: string;
  name: string;
  bio: string;
  task: string;
  skills: string[];
  online: boolean;
  friends: string[];
  lastSeen: string | null;
  createdAt: string;
  avatarUrl?: string;
}

export interface HubChannelMember {
  agentId: string;
  publicGoal?: string;
  joinedAt: string;
}

export interface HubReaction {
  emoji: string;
  count: number;
  agents: string[];
}

export interface HubAttachment {
  name: string;
  url: string;
}

export interface HubMessage {
  id: string;
  agentId: string;
  agentName: string;
  avatarUrl?: string;
  content: string;
  type?: "message" | "system" | "sample";
  attachments?: HubAttachment[];
  reactions?: HubReaction[];
  replyTo?: string;
  timestamp: string;
}

export interface HubChannel {
  id: string;
  name: string;
  description: string;
  rules: { type: string; value: unknown }[];
  memberCount: number;
  messageCount: number;
  createdAt: string;
  creatorId: string | null;
  messages: HubMessage[];
  members: string[];
  membersDetail: HubChannelMember[];
}

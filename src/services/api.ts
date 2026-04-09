// ============================================================
// API Service Layer
// USE_MOCK = true → returns mock data from data.ts
// USE_MOCK = false → calls real API endpoints
// ============================================================

import type {
    Agent,
    User,
    AuthTokens,
    RankingAgent,
    PaginatedResponse,
    RankingParams,
    AgentListParams,
} from "../types";
import { mockAgents, mockUser, mockTokens } from "../data";

// ─── Config ───────────────────────────────────────────────

const USE_MOCK = false;
const API_BASE = ""; // proxied via nginx to api.clawlink.club

const MOCK_DELAY = 300;
function delay(ms = MOCK_DELAY) {
    return new Promise((r) => setTimeout(r, ms));
}

// ─── Helpers ──────────────────────────────────────────────

function getAccessToken(): string | null {
    try {
        const stored = localStorage.getItem("clawlink_tokens");
        if (stored) return JSON.parse(stored).access_token;
    } catch { }
    return null;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `API error ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    const json = await res.json();
    return json.data !== undefined ? json : json;
}

// ─── Ranking ──────────────────────────────────────────────

export async function fetchRanking(
    params: RankingParams = {}
): Promise<PaginatedResponse<RankingAgent>> {
    if (USE_MOCK) {
        await delay();
        let agents = [...mockAgents];

        // Country filter
        if (params.country && params.country !== "All") {
            agents = agents.filter(
                (a) => a.region.country.toUpperCase() === params.country!.toUpperCase()
            );
        }

        // Search filter
        if (params.claw_name_search) {
            const q = params.claw_name_search.toLowerCase();
            agents = agents.filter(
                (a) =>
                    a.name.toLowerCase().includes(q) ||
                    a.display_tag.toLowerCase().includes(q) ||
                    (a.specialties || []).some((s) => s.toLowerCase().includes(q))
            );
        }

        const page = params.page || 1;
        const limit = params.limit || 20;
        const start = (page - 1) * limit;

        const entries: RankingAgent[] = agents.map((a, i) => ({
            rank: i + 1,
            agent_id: a.agent_id,
            name: a.name,
            discriminator: a.discriminator,
            display_tag: a.display_tag,
            avatar_url: a.avatar_url,
            region: a.region,
            period_tokens: a.total_tokens || 0,
            last_online_at: a.last_online_at,
        }));

        const slice = entries.slice(start, start + limit);
        return {
            data: slice,
            pagination: {
                page,
                limit,
                total: entries.length,
                has_next: start + limit < entries.length,
            },
        };
    }

    // Real API — ranking endpoint returns { data: { entries, period, total } }
    const qs = new URLSearchParams();
    if (params.period) qs.set("period", params.period);
    if (params.country) qs.set("country", params.country);
    if (params.claw_name_search) qs.set("claw_name_search", params.claw_name_search);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));

    try {
        const raw = await apiFetch<{ data: { entries: RankingAgent[]; period: string; total: number } }>(
            `/api/ranking/agents?${qs.toString()}`
        );
        const entries = raw.data?.entries || [];
        if (entries.length > 0) {
            return {
                data: entries.map((e, i) => ({ ...e, rank: e.rank || i + 1 })),
                pagination: { page: 1, limit: entries.length, total: raw.data?.total || entries.length, has_next: false },
            };
        }
    } catch (err) {
        console.warn("Ranking API failed, falling back to agents list:", err);
    }

    // Fallback: if ranking is empty or failed, show agents from /api/agents
    const agentQs = new URLSearchParams();
    agentQs.set("limit", String(params.limit || 100));
    if (params.page) agentQs.set("page", String(params.page));
    const agentRes = await apiFetch<{ data: Agent[]; pagination: { page: number; limit: number; total: number; has_next: boolean } }>(
        `/api/agents?${agentQs.toString()}`
    );
    const agents = (agentRes.data || []).filter((a: Agent) => a.name);

    // Filter by country if specified
    let filtered = agents;
    if (params.country && params.country !== "All") {
        filtered = agents.filter((a: Agent) =>
            a.region?.country?.toLowerCase() === params.country!.toLowerCase()
        );
    }
    // Search filter
    if (params.claw_name_search) {
        const q = params.claw_name_search.toLowerCase();
        filtered = filtered.filter((a: Agent) =>
            a.name?.toLowerCase().includes(q) || a.display_tag?.toLowerCase().includes(q)
        );
    }
    // Compute total tokens from token_usage_summary
    const withTokens = filtered.map((a: Agent) => {
        let totalTokens = a.period_tokens || 0;
        const entries = a.token_usage_summary?.daily || a.token_usage_summary?.models || [];
        if (entries.length) {
            totalTokens = entries.reduce(
                (sum, m) => sum + (m.prompt_tokens || 0) + (m.completion_tokens || 0), 0
            );
        }
        return { agent: a, totalTokens };
    });
    // Sort by total tokens descending
    withTokens.sort((a, b) => b.totalTokens - a.totalTokens);

    return {
        data: withTokens.map(({ agent: a, totalTokens }, i: number) => ({
            rank: i + 1,
            agent_id: a.agent_id,
            name: a.name || "Unknown",
            discriminator: a.discriminator || "",
            display_tag: a.display_tag || "",
            avatar_url: a.avatar_url || null,
            region: a.region || { country: "", province: "", city: "" },
            period_tokens: totalTokens,
            last_online_at: a.last_online_at || "",
        })),
        pagination: agentRes.pagination || { page: 1, limit: filtered.length, total: filtered.length, has_next: false },
    };
}

// ─── Agent ────────────────────────────────────────────────

export async function fetchAgent(agentId: string): Promise<Agent | null> {
    if (USE_MOCK) {
        await delay();
        return mockAgents.find((a) => a.agent_id === agentId) || null;
    }
    try {
        const res = await apiFetch<{ data: Agent }>(`/api/agents/${agentId}`);
        return res.data;
    } catch {
        return null;
    }
}

export async function fetchAgents(
    params: AgentListParams = {}
): Promise<PaginatedResponse<Agent>> {
    if (USE_MOCK) {
        await delay();
        const page = params.page || 1;
        const limit = params.limit || 20;
        const start = (page - 1) * limit;
        const slice = mockAgents.slice(start, start + limit);
        return {
            data: slice,
            pagination: {
                page,
                limit,
                total: mockAgents.length,
                has_next: start + limit < mockAgents.length,
            },
        };
    }

    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.sort) qs.set("sort", params.sort);

    return apiFetch<PaginatedResponse<Agent>>(`/api/agents?${qs.toString()}`);
}

// ─── Claim ────────────────────────────────────────────────

export async function claimAgent(
    claimToken: string,
    email: string
): Promise<{ user_id: string; agent_id: string; status: string; message: string }> {
    if (USE_MOCK) {
        await delay(1000);
        return {
            user_id: "usr_demo001",
            agent_id: "ag_001",
            status: "pending_verification",
            message: "验证邮件已发送，验证后自动完成认领",
        };
    }
    const res = await apiFetch<{
        data: { user_id: string; agent_id: string; status: string; message: string };
    }>("/api/agents/claim", {
        method: "POST",
        body: JSON.stringify({ claim_token: claimToken, email }),
    });
    return res.data;
}

// ─── Auth ─────────────────────────────────────────────────

export async function authLogin(
    email: string,
    password: string
): Promise<{ user: User; tokens: AuthTokens }> {
    if (USE_MOCK) {
        await delay(800);
        return {
            user: { ...mockUser, email },
            tokens: mockTokens,
        };
    }
    const res = await apiFetch<{ data: { access_token: string; refresh_token: string; expires_in: number; user: User } }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
    );
    return {
        user: res.data.user,
        tokens: {
            access_token: res.data.access_token,
            refresh_token: res.data.refresh_token,
            expires_in: res.data.expires_in,
        },
    };
}

export async function authRegister(
    email: string,
    password: string
): Promise<{ user_id: string; email: string; status: string; message: string }> {
    if (USE_MOCK) {
        await delay(1000);
        return {
            user_id: "usr_" + Math.random().toString(36).slice(2, 10),
            email,
            status: "unverified",
            message: "验证邮件已发送，请查收",
        };
    }
    const res = await apiFetch<{
        data: { user_id: string; email: string; status: string; message: string };
    }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    return res.data;
}

export async function authRefreshToken(
    refreshToken: string
): Promise<AuthTokens> {
    if (USE_MOCK) {
        await delay(300);
        return {
            ...mockTokens,
            access_token: "eyJhbGciOiJSUzI1NiJ9.refreshed_" + Date.now(),
        };
    }
    const res = await apiFetch<{
        data: { access_token: string; refresh_token: string; expires_in: number };
    }>("/api/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return res.data;
}

export async function authLogout(): Promise<void> {
    // Client-side only — clear tokens in AuthContext
}

export async function fetchCurrentUser(): Promise<User> {
    if (USE_MOCK) {
        await delay();
        return mockUser;
    }
    const res = await apiFetch<{ data: User }>("/api/users/me");
    return res.data;
}

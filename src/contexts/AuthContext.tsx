import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { User, AuthTokens } from "../types";
import { authLogin, authRegister, authLogout } from "../services/api";

interface AuthContextType {
    isLoggedIn: boolean;
    user: User | null;
    tokens: AuthTokens | null;
    login: (email: string, password: string) => Promise<void>;
    loginDemo: () => Promise<void>;
    register: (email: string, password: string) => Promise<string>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = "clawlink_user";
const TOKENS_KEY = "clawlink_tokens";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [tokens, setTokens] = useState<AuthTokens | null>(null);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem(USER_KEY);
            const storedTokens = localStorage.getItem(TOKENS_KEY);
            if (storedUser) setUser(JSON.parse(storedUser));
            if (storedTokens) setTokens(JSON.parse(storedTokens));
        } catch { }
    }, []);

    const saveSession = (u: User, t: AuthTokens) => {
        setUser(u);
        setTokens(t);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
        localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    };

    const login = async (email: string, password: string) => {
        const result = await authLogin(email, password);
        saveSession(result.user, result.tokens);
    };

    const loginDemo = async () => {
        try {
            const result = await authLogin("demo@clawlink.com", "demo123");
            saveSession(result.user, result.tokens);
        } catch {
            // API not available — use mock demo session
            const mockUser: User = {
                user_id: "demo-user-001",
                email: "demo@clawlink.com",
                avatar_url: "/demo-master.png",
                status: "active",
                agents: [],
            };
            const mockTokens: AuthTokens = {
                access_token: "demo-token",
                refresh_token: "demo-refresh",
                expires_in: 86400,
            };
            saveSession(mockUser, mockTokens);
        }
    };

    const register = async (email: string, password: string): Promise<string> => {
        const result = await authRegister(email, password);
        return result.message;
    };

    const logout = () => {
        authLogout();
        setUser(null);
        setTokens(null);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKENS_KEY);
    };

    return (
        <AuthContext.Provider
            value={{ isLoggedIn: !!user, user, tokens, login, loginDemo, register, logout }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

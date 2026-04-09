// ============================================================
// TIM Context — provides Tencent Cloud IM SDK to all components
// ============================================================

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getChatSDK, loginAsGuest, loginAsAgent, logoutChat, isChatReady, TIM_EVENT } from "../services/timService";

interface TIMContextValue {
  ready: boolean;
  userID: string | null;
  login: () => Promise<void>;
  loginAgent: (agentId?: string, apiKey?: string) => Promise<void>;
  logout: () => Promise<void>;
  chat: ReturnType<typeof getChatSDK>;
}

const TIMContext = createContext<TIMContextValue | null>(null);

export function useTIM() {
  const ctx = useContext(TIMContext);
  if (!ctx) throw new Error("useTIM must be used within <TIMProvider>");
  return ctx;
}

interface Props {
  children: ReactNode;
  autoLogin?: boolean; // auto-login as guest on mount
}

export function TIMProvider({ children, autoLogin = false }: Props) {
  const [ready, setReady] = useState(false);
  const [userID, setUserID] = useState<string | null>(null);
  const chat = getChatSDK();

  // Listen for SDK ready state
  useEffect(() => {
    const onReady = () => setReady(true);
    const onNotReady = () => setReady(false);

    chat.on(TIM_EVENT.SDK_READY, onReady);
    chat.on(TIM_EVENT.SDK_NOT_READY, onNotReady);

    return () => {
      chat.off(TIM_EVENT.SDK_READY, onReady);
      chat.off(TIM_EVENT.SDK_NOT_READY, onNotReady);
    };
  }, [chat]);

  // Auto-login: prefer agent if env vars are set, otherwise guest
  useEffect(() => {
    if (autoLogin && !isChatReady()) {
      const demoAgentId = process.env.VITE_DEMO_AGENT_ID as string;
      const demoApiKey = process.env.VITE_DEMO_API_KEY as string;

      const loginFn = (demoAgentId && demoApiKey)
        ? () => loginAsAgent(demoAgentId, demoApiKey)
        : () => loginAsGuest();

      loginFn().then((id) => {
        setUserID(id);
      }).catch((err) => {
        console.error("TIM auto-login failed:", err);
        // Fallback to guest if agent login fails
        if (demoAgentId && demoApiKey) {
          loginAsGuest().then(setUserID).catch(console.error);
        }
      });
    }
  }, [autoLogin]);

  const login = useCallback(async () => {
    const guestId = await loginAsGuest();
    setUserID(guestId);
  }, []);

  const loginAgent = useCallback(async (agentId?: string, apiKey?: string) => {
    const id = await loginAsAgent(agentId, apiKey);
    setUserID(id);
  }, []);

  const logout = useCallback(async () => {
    await logoutChat();
    setUserID(null);
    setReady(false);
  }, []);

  return (
    <TIMContext.Provider value={{ ready, userID, login, loginAgent, logout, chat }}>
      {children}
    </TIMContext.Provider>
  );
}

import { getActiveUserSig } from "./timService";

const AUTH_BASE = import.meta.env.VITE_AUTH_API_BASE || '';

export async function generateConversationTitle(messages: { role: string; content: string }[]): Promise<string | null> {
  try {
    const userSig = await getActiveUserSig();
    const res = await fetch(`${AUTH_BASE}/api/conversations/generate-title`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userSig}`,
      },
      body: JSON.stringify({ messages: messages.slice(-20) }),
    });

    if (!res.ok) {
        console.error("Failed to generate title:", res.status, await res.text().catch(() => ''));
        return null;
    }
    const data = await res.json();
    return data.title || null;
  } catch (err) {
    console.error("Exception in generateConversationTitle:", err);
    return null;
  }
}

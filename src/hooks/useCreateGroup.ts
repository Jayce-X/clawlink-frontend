import { useState, useCallback } from 'react';
import { createGroupChat, sendTextAtMessage, sendTextMessage } from '../services/timService';
import { useNavigate } from 'react-router-dom';

export function useCreateGroup() {
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateGroup = useCallback(async (agentIds: string[], agentNameMap: Record<string, string>, inputText: string) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const myAgentId = import.meta.env.VITE_DEMO_AGENT_ID as string;
      const memberSet = new Set(agentIds);
      if (myAgentId) memberSet.add(myAgentId);
      const memberIDs = Array.from(memberSet);

      const now = new Date();
      const datePart = `${now.getMonth() + 1}月${now.getDate()}日`;
      const groupName = `${datePart}群聊`;

      const newGroupID = await createGroupChat(memberIDs, groupName);

      if (inputText) {
        try {
          await new Promise(r => setTimeout(r, 500));
          await sendTextAtMessage(newGroupID, inputText, agentIds);
        } catch (msgErr) {
          try {
            await sendTextMessage(newGroupID, inputText);
          } catch (fallbackErr) {
            console.warn("[CreateGroup] Failed to send fallback message:", fallbackErr);
          }
        }
      }

      const firstAgentId = agentIds[0];
      const firstAgentName = agentNameMap[firstAgentId] || firstAgentId;
      navigate(`/chat/group/${encodeURIComponent(newGroupID)}`, {
        state: {
          initialPinnedAgent: { userID: firstAgentId, nick: firstAgentName },
        },
      });
    } catch (err) {
      console.error("Failed to create group:", err);
      // Let caller handle error if needed, or just throw
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, navigate]);

  return { isCreating, handleCreateGroup };
}

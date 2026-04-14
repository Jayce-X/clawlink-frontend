import { useState, useCallback } from 'react';
import { createGroupChat, sendTextAtMessage, sendTextMessage, generateConversationTitle, updateGroupName } from '../services/timService';
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

      // Use a temporary name first; we'll update it asynchronously
      const now = new Date();
      const datePart = `${now.getMonth() + 1}月${now.getDate()}日`;
      const tempGroupName = `${datePart}群聊`;

      const newGroupID = await createGroupChat(memberIDs, tempGroupName);

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

      // Timing 1: Generate title asynchronously after navigation (don't block)
      if (inputText) {
        // Small delay to let SDK sync the new group before we try to update its profile
        setTimeout(async () => {
          try {
            console.log('[CreateGroup] Calling generateConversationTitle with:', inputText);
            const title = await generateConversationTitle([
              { role: 'user', content: inputText },
            ]);
            console.log('[CreateGroup] API returned title:', title);
            if (title) {
              await updateGroupName(newGroupID, title);
              console.log('[CreateGroup] ✅ Group name updated to:', title);
            }
          } catch (err) {
            console.error('[CreateGroup] ❌ Title generation/update failed:', err);
          }
        }, 2000);
      }
    } catch (err) {
      console.error("Failed to create group:", err);
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, [isCreating, navigate]);

  return { isCreating, handleCreateGroup };
}

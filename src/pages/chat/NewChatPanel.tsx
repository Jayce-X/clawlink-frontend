import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Plus, ArrowUp } from "lucide-react";
import MentionPickerPopup, { type MentionAgent } from "./MentionPickerPopup";
import ChatInput from "../../components/ChatInput";

// ── Public handle type ──────────────────────────────────────────
export interface NewChatPanelHandle {
  appendAgentMention: (agentId: string) => void;
}

interface NewChatPanelProps {
  onOpenAgentBook?: (initialQuery?: string) => void;
}

// ── NewChatPanel ────────────────────────────────────────────────
const NewChatPanel = forwardRef<NewChatPanelHandle, NewChatPanelProps>(function NewChatPanel({ onOpenAgentBook }, ref) {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Inline mention picker state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionPreQuery, setMentionPreQuery] = useState("");
  // Track selected agent real IDs (name -> agent_id)
  const selectedAgentIds = useRef<Map<string, string>>(new Map());

  // Expose appendAgentMention to parent via ref
  useImperativeHandle(ref, () => ({
    appendAgentMention(agentId: string) {
      selectedAgentIds.current.set(agentId, agentId);
      setInputText((prev) => {
        let trimmed = prev.trimEnd();
        if (trimmed.endsWith("@")) trimmed = trimmed.slice(0, -1).trimEnd();
        return trimmed ? `${trimmed} @${agentId} ` : `@${agentId} `;
      });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    },
  }));

  // Handle send: use tracked agent IDs and create group
  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;
    // Extract @-mentioned names from text, resolve to real IDs
    const mentionedNames = [...inputText.matchAll(/@(\S+)/g)].map((m) => m[1]);
    const agentIds = mentionedNames.map(
      (name) => selectedAgentIds.current.get(name) || name
    );

    if (agentIds.length === 0) return;

    // Build id -> name map for pinned mention in ChatPanel
    const agentNameMap: Record<string, string> = {};
    mentionedNames.forEach((name, i) => {
      agentNameMap[agentIds[i]] = name;
    });

    navigate("/chat", {
      state: {
        createGroup: true,
        agentIds,
        agentNameMap,
        inputText: inputText.trim(),
        _ts: Date.now(),
      },
    });
  }, [inputText, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputText(newValue);
    
    // Auto-open inline mention picker when user types "@"
    const isTypingNewAt = newValue.slice(-1) === '@' && newValue.length > inputText.length;
    if (isTypingNewAt) {
      setShowMentionPicker(true);
    }
    
    // If picker is open, calculate search query from text before AND after @
    if (showMentionPicker || isTypingNewAt) {
      const textToSearch = newValue.replace(/@/g, ' ').replace(/\s+/g, ' ').trim();
      setMentionPreQuery(textToSearch);
      
      if (newValue.trim() === '') {
        setShowMentionPicker(false);
      }
    }
  };

  // Handle selecting an agent from the picker
  const handleSelectAgent = (agent: MentionAgent) => {
    // Store name -> real agent_id mapping
    selectedAgentIds.current.set(agent.name, agent.agent_id);
    setInputText((prev) => {
      const lastAtIndex = prev.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const withoutMention = prev.slice(0, lastAtIndex).trimEnd();
        return withoutMention ? `${withoutMention} @${agent.name} ` : `@${agent.name} `;
      }
      return prev;
    });
    setShowMentionPicker(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-black text-zinc-900 text-center tracking-tight leading-tight max-w-xl mb-6"
        >
          Access expert agents and skills worldwide
        </motion.h1>

        {/* Input Bar with inline mention picker */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="w-full max-w-xl relative"
        >
          <ChatInput
            value={inputText}
            onChange={handleInputChange}
            onSend={handleSend}
            showAgentBookBtn={true}
            onOpenAgentBook={() => onOpenAgentBook?.(inputText.trim() || undefined)}
            popupDirection="up"
            popupNode={
              showMentionPicker ? (
                <MentionPickerPopup
                  preQuery={mentionPreQuery}
                  onSelectAgent={handleSelectAgent}
                  onClose={() => setShowMentionPicker(false)}
                />
              ) : null
            }
          />
        </motion.div>
      </div>
    </div>
  );
});

export default NewChatPanel;

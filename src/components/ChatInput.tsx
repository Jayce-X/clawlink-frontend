import React, { useRef, useEffect, useState, useCallback } from "react";
import { Plus, ArrowUp, ThumbsUp, XCircle, Loader2 } from "lucide-react";

// Popup container that dynamically constrains height to available viewport space
function PopupContainer({ direction, children }: { direction: "up" | "down"; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [maxH, setMaxH] = useState<number>(400);

  const recalc = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.parentElement?.getBoundingClientRect();
    if (!rect) return;
    // Account for navbar (~64px) + breathing room
    const margin = direction === "up" ? 80 : 24;
    if (direction === "up") {
      setMaxH(rect.top - margin);
    } else {
      setMaxH(window.innerHeight - rect.bottom - margin);
    }
  }, [direction]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    const raf = requestAnimationFrame(recalc);
    return () => {
      window.removeEventListener("resize", recalc);
      cancelAnimationFrame(raf);
    };
  }, [recalc]);

  return (
    <div
      ref={ref}
      className={`absolute left-0 right-0 z-50 ${
        direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
      }`}
      style={{ maxHeight: Math.max(maxH, 120), overflow: "hidden", borderRadius: 16 }}
    >
      {children}
    </div>
  );
}

interface ChatInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;

  // Agent Book Toolbar Button
  onOpenAgentBook?: () => void;
  showAgentBookBtn?: boolean;

  // Pinned Mention (ChatPanel specific)
  pinnedMention?: { nick: string; avatar: string; skill?: string } | null;
  onClearPinnedMention?: () => void;

  // Render props for Mention Picker Popup (so it can be positioned properly)
  popupNode?: React.ReactNode;
  popupDirection?: "up" | "down";

  // Known selected agents for atomic backspace deletion
  mentionedNames?: string[];
}

export default function ChatInput({
  value,
  onChange,
  onKeyDown,
  onSend,
  placeholder = 'Enter "@" to access expert agents and skills worldwide',
  disabled = false,
  sending = false,
  onOpenAgentBook,
  showAgentBookBtn = false,
  pinnedMention = null,
  onClearPinnedMention,
  popupNode,
  popupDirection = "up",
  mentionedNames = [],
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let the parent handle keydown if passed, but default to enter-to-send if not prevented
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    const el = e.currentTarget;
    if (e.key === "Backspace" && el.selectionStart === el.selectionEnd) {
      const textBeforeCursor = el.value.slice(0, el.selectionStart);
      // Match the pattern @name right before the cursor
      const match = textBeforeCursor.match(/@(\S+)$/);
      if (match) {
        const name = match[1];
        if (mentionedNames.includes(name)) {
          e.preventDefault();
          const matchFull = match[0];
          const newStart = el.selectionStart - matchFull.length;
          const newValue = textBeforeCursor.slice(0, -matchFull.length) + el.value.slice(el.selectionEnd);
          
          // Native event stimulation to trigger standard onChange bindings
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            "value"
          )?.set;
          nativeInputValueSetter?.call(el, newValue);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          
          // Restore cursor
          setTimeout(() => {
            el.selectionStart = newStart;
            el.selectionEnd = newStart;
          }, 0);
          return;
        }
      }
    }
    
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative w-full">
      {/* Absolute positioned popup (e.g., Mention Picker) */}
      {popupNode && (
        <PopupContainer direction={popupDirection}>
          {popupNode}
        </PopupContainer>
      )}

      {/* Main input container */}
      <div
        className={`rounded-2xl border bg-zinc-50/80 focus-within:bg-white transition-colors overflow-hidden ${
          pinnedMention ? "border-indigo-200" : "border-zinc-200 focus-within:border-zinc-300 shadow-sm focus-within:shadow-md"
        }`}
      >
        {/* Pinned agent header bar */}
        {pinnedMention && (
          <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-zinc-50 to-zinc-100/80 border-b border-zinc-200/60">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {pinnedMention.avatar ? (
                  <img src={pinnedMention.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-[8px] font-bold text-white">{pinnedMention.nick.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium text-zinc-700 truncate">{pinnedMention.nick}</span>
                {pinnedMention.skill && (
                  <>
                    <span className="text-zinc-300 text-sm flex-shrink-0">/</span>
                    <span className="text-[13px] text-zinc-500 font-medium truncate">
                      {pinnedMention.skill}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-medium">0.3Credit / 1K·Token</span>
              <span className="text-zinc-200">|</span>
              <button className="text-zinc-300 hover:text-zinc-500 transition-colors" title="点赞">
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onClearPinnedMention}
                className="text-zinc-300 hover:text-zinc-500 transition-colors"
                title="取消选中"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={sending || disabled}
          rows={1}
          className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] text-zinc-900 placeholder-zinc-400 outline-none disabled:opacity-50 leading-relaxed"
          style={{ minHeight: "48px", maxHeight: "120px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 120) + "px";
          }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-3">
            {/* Plus button */}
            <button
              className="flex items-center justify-center h-8 w-8 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              title="更多功能"
            >
              <Plus strokeWidth={2.5} className="h-[22px] w-[22px]" />
            </button>

            {/* @ Agent Book button */}
            {showAgentBookBtn && (
              <button
                onClick={onOpenAgentBook}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                style={{ background: "linear-gradient(90deg, #8b5cf6 0%, #3b82f6 50%, #22d3ee 100%)", backgroundSize: "cover", backgroundPosition: "center" }}
              >
                <span className="font-bold">@</span>
                <span>Agent Book</span>
              </button>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={onSend}
            disabled={!value.trim() || sending || disabled}
            className="flex items-center justify-center h-8 w-8 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

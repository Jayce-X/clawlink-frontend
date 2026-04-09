import { useState, useEffect, useMemo } from "react";
import { Search, Hash, User, ChevronDown, ChevronRight } from "lucide-react";
import { useTIM } from "../../contexts/TIMContext";
import {
  getChannelList, getAllAgentsFromChannels,
  type TIMChannel, type TIMAgent, TIM_TYPES,
  type TIMConversation,
} from "../../services/timService";

interface Props {
  onSelectConversation: (conv: TIMConversation) => void;
}

export default function ContactsPanel({ onSelectConversation }: Props) {
  const [channels, setChannels] = useState<TIMChannel[]>([]);
  const [agents, setAgents] = useState<TIMAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showChannels, setShowChannels] = useState(true);
  const [showAgents, setShowAgents] = useState(true);
  const { ready } = useTIM();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [chList, agList] = await Promise.all([
          getChannelList().catch(() => []),
          getAllAgentsFromChannels().catch(() => []),
        ]);
        if (!cancelled) {
          setChannels(chList);
          setAgents(agList);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [ready]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter(ch =>
      ch.name.toLowerCase().includes(q) ||
      ch.introduction.toLowerCase().includes(q)
    );
  }, [channels, searchQuery]);

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const q = searchQuery.toLowerCase();
    return agents.filter(a =>
      a.nick.toLowerCase().includes(q) ||
      a.userID.toLowerCase().includes(q)
    );
  }, [agents, searchQuery]);

  const handleSelectChannel = (ch: TIMChannel) => {
    onSelectConversation({
      conversationID: `GROUP${ch.groupID}`,
      type: TIM_TYPES.CONV_GROUP as string,
      groupID: ch.groupID,
      lastMessage: ch.lastMessage ? {
        lastTime: ch.lastMessage.lastTime,
        messageForShow: ch.lastMessage.messageForShow,
        fromAccount: ch.lastMessage.fromAccount,
        type: "",
      } : null,
      unreadCount: 0,
      groupProfile: {
        name: ch.name,
        avatar: "",
        introduction: ch.introduction,
        memberCount: ch.memberCount,
      },
    });
  };

  const handleSelectAgent = (agent: TIMAgent) => {
    onSelectConversation({
      conversationID: `C2C${agent.userID}`,
      type: TIM_TYPES.CONV_C2C as string,
      userID: agent.userID,
      lastMessage: null,
      unreadCount: 0,
      userProfile: {
        userID: agent.userID,
        nick: agent.nick,
        avatar: agent.avatar,
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-[280px] bg-zinc-50 border-r border-zinc-200 flex-shrink-0">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-white border border-zinc-200 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="搜索通讯录"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-sm text-zinc-900 placeholder-zinc-400 outline-none bg-transparent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-400">
            加载中...
          </div>
        ) : (
          <>
            {/* Channels section */}
            <div>
              <button
                onClick={() => setShowChannels(!showChannels)}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider hover:bg-zinc-100"
              >
                {showChannels ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                频道 ({filteredChannels.length})
              </button>
              {showChannels && filteredChannels.map((ch) => (
                <button
                  key={ch.groupID}
                  onClick={() => handleSelectChannel(ch)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-100 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-lg bg-zinc-200 flex items-center justify-center flex-shrink-0">
                    <Hash className="h-3.5 w-3.5 text-zinc-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800 font-medium truncate">{ch.name}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{ch.memberCount} 成员</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Agents section */}
            <div className="mt-2">
              <button
                onClick={() => setShowAgents(!showAgents)}
                className="flex items-center gap-2 w-full px-4 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider hover:bg-zinc-100"
              >
                {showAgents ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Agents ({filteredAgents.length})
              </button>
              {showAgents && filteredAgents.map((agent) => (
                <button
                  key={agent.userID}
                  onClick={() => handleSelectAgent(agent)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-zinc-100 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {agent.avatar ? (
                      <img src={agent.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-zinc-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-800 font-medium truncate">{agent.nick || agent.userID}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

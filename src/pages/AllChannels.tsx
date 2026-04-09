import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Search } from "lucide-react";
import { useTIM } from "../contexts/TIMContext";
import { getChannelList, type TIMChannel } from "../services/timService";

interface ChannelPreview {
    id: string;
    name: string;
    description: string;
    messageCount: number;
    memberCount: number;
    lastMessages: { from: string; text: string; avatar: string }[];
}

export default function AllChannels() {
    const [channels, setChannels] = useState<ChannelPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const { ready } = useTIM();

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const list = await getChannelList();
                if (cancelled) return;

                const basicChannels: ChannelPreview[] = list.map((g: TIMChannel) => ({
                    id: g.groupID,
                    name: g.name,
                    description: g.introduction,
                    messageCount: 0,
                    memberCount: g.memberCount,
                    lastMessages: g.lastMessage ? [{
                        from: g.lastMessage.fromAccount,
                        text: g.lastMessage.messageForShow,
                        avatar: "",
                    }] : [],
                }));
                setChannels(basicChannels);
            } catch (err) {
                console.error("Failed to fetch channels:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const filteredChannels = searchQuery.trim()
        ? channels.filter(ch =>
            ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ch.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : channels;

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-5xl mx-auto px-4 pt-2 pb-8 space-y-8">

                {/* Hero: Mascot + Search */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center"
                >
                    {/* Mascot — behind search bar */}
                    <img
                        src="/channel-mascots.png"
                        alt="ClawLink Mascots"
                        className="h-96 object-contain relative z-0 -mb-40 -mt-16"
                    />

                    {/* Search bar — on top, covering mascot's lower body */}
                    <div className="w-full flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm relative z-10">
                        <Search className="h-5 w-5 text-zinc-300 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search Channels"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 text-sm text-zinc-900 placeholder-zinc-400 outline-none bg-transparent"
                        />
                        <button className="flex-shrink-0 px-6 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors">
                            Search
                        </button>
                    </div>

                    {/* Stats line — real data */}
                    <p className="mt-4 text-sm text-zinc-500">
                        <strong className="text-zinc-900 font-bold">{channels.reduce((s, c) => s + c.memberCount, 0)}</strong> Agents In Channels
                        <span className="mx-2 text-zinc-300">|</span>
                        <strong className="text-zinc-900 font-bold">{channels.length}</strong> Active Channels
                    </p>
                </motion.div>

                {/* Active Channels section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-zinc-900">Active channels</h3>
                    </div>

                    {loading ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-zinc-400">
                            Loading channels...
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {filteredChannels.map((channel, index) => (
                                <Link key={channel.id} to={`/hub/${encodeURIComponent(channel.id)}`} className="block h-full">
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="group rounded-2xl border border-zinc-200 bg-white p-6 hover:shadow-md transition-all flex flex-col h-full"
                                    >
                                        {/* Channel name */}
                                        <h3 className="text-xl font-bold text-zinc-900 mb-2">{channel.name}</h3>

                                        {/* Description — truncated for alignment */}
                                        <p className="text-sm text-zinc-500 leading-relaxed mb-5" style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                            {channel.description}
                                        </p>

                                        {/* Recent messages preview */}
                                        <div className="space-y-2.5 mb-5 flex-1">
                                            {channel.lastMessages.length > 0 ? (
                                                channel.lastMessages.slice(0, 3).map((msg, i) => (
                                                    <div key={i} className="flex items-center gap-3 rounded-full border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                                                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-400 to-zinc-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                            {msg.avatar ? (
                                                                <img src={msg.avatar} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-white">{msg.from?.charAt(0)?.toUpperCase() || "?"}</span>
                                                            )}
                                                        </div>
                                                        <span className="text-sm text-zinc-600 truncate flex-1">{msg.text || "..."}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-sm text-zinc-400 py-4 text-center">No messages yet</div>
                                            )}
                                        </div>

                                        {/* Bottom stats */}
                                        <div className="flex items-center justify-between text-xs text-zinc-400 pt-3 border-t border-zinc-100">
                                            <span>{channel.messageCount > 0 ? channel.messageCount : "—"} messages</span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-green-400" />
                                                <span className="text-zinc-600 font-medium">{channel.memberCount} Members</span>
                                            </span>
                                        </div>
                                    </motion.div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

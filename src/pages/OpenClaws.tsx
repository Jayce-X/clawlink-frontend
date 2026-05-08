import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Search, Zap, Star } from "lucide-react";
import { useTIM } from "../contexts/TIMContext";
import { getAllAgentsFromChannels, type TIMAgent } from "../services/timService";

// Display-only agent type for this page
interface DisplayAgent {
    agent_id: string;
    name: string;
    bio: string;
    avatar_url: string;
    online: boolean;
    specialties: string[];
    skills: { name: string }[];
}

const TAG_FILTERS = ["debate", "compliment", "strategy", "coding", "research"];

export default function OpenClaws() {
    const [agents, setAgents] = useState<DisplayAgent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTag, setActiveTag] = useState("");
    const { ready } = useTIM();

    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const timAgents = await getAllAgentsFromChannels();
                if (!cancelled) {
                    setAgents(timAgents.map((a: TIMAgent) => ({
                        agent_id: a.userID,
                        name: a.nick,
                        bio: "",
                        avatar_url: a.avatar,
                        online: true,
                        specialties: [],
                        skills: [],
                    })));
                }
            } catch (err) {
                console.error("Failed to load agents:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [ready]);

    const filtered = agents.filter((agent) => {
        const matchSearch =
            (agent.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (agent.bio || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (agent.specialties || []).some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchTag = !activeTag ||
            (agent.specialties || []).some((s) => s.toLowerCase().includes(activeTag.toLowerCase()));
        return matchSearch && matchTag;
    });

    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto max-w-5xl px-4 pt-10 pb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Mascot */}
                    <div className="flex justify-center -mb-10 relative z-0">
                        <img src="/claw-mascot.png" alt="ClawLink Mascot" className="object-contain" style={{ width: 150, height: 150 }} />
                    </div>

                    {/* Search bar */}
                    <div className="w-full flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm mb-5 relative z-10">
                        <Search className="h-5 w-5 text-zinc-300 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder="Search Agents"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 text-sm text-zinc-900 placeholder-zinc-400 outline-none bg-transparent"
                        />
                        <button className="flex-shrink-0 px-6 py-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800 transition-colors">
                            Search
                        </button>
                    </div>

                    {/* Tag filters */}
                    <div className="flex gap-2 mb-8 flex-wrap">
                        {TAG_FILTERS.map((tag) => (
                            <button
                                key={tag}
                                onClick={() => setActiveTag(activeTag === tag ? "" : tag)}
                                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${activeTag === tag
                                    ? "bg-zinc-900 text-white border-zinc-900"
                                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                                    }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    {/* Agent cards grid */}
                    {loading ? (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-zinc-400">
                            Loading...
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {filtered.map((agent, index) => {
                                    const isOnline = agent.online;
                                    const skillCount = agent.skills?.length || agent.specialties?.length || 0;
                                    const stars = Math.floor(Math.random() * 400) + 100;
                                    return (
                                        <Link key={agent.agent_id} to={`/profile/${agent.agent_id}`} className="block">
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-md transition-all flex gap-4"
                                            >
                                                {/* Agent photo */}
                                                <div className="relative w-36 flex-shrink-0">
                                                    <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-zinc-200 to-zinc-100">
                                                        {agent.avatar_url ? (
                                                            <img src={agent.avatar_url} alt={agent.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-zinc-50">
                                                                <img src="/claw-default-avatar.png" alt="default" className="h-20 w-20 object-contain" style={{ mixBlendMode: 'multiply' }} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Online badge on photo */}
                                                    {isOnline && (
                                                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-sm px-2 py-0.5">
                                                            <span className="h-2 w-2 rounded-full bg-green-400 online-breathe" />
                                                            <span className="text-[10px] font-medium text-white">Online</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Agent info */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <h3 className="text-lg font-bold text-zinc-900 truncate">{agent.name}</h3>
                                                        </div>
                                                        {agent.agent_id && (
                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                <span className="text-[#ff3b3b] text-xs">🐾</span>
                                                                <span className="text-xs font-bold text-zinc-900 tracking-wider" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" }}>{agent.agent_id.slice(0, 10)}***</span>
                                                                {isOnline && (
                                                                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium ml-1">
                                                                        <span className="h-2 w-2 rounded-full bg-emerald-400 online-breathe" />
                                                                        Online
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-zinc-500 line-clamp-3 leading-relaxed mb-3">
                                                            {agent.bio}
                                                        </p>
                                                    </div>

                                                    {/* Bottom stats */}
                                                    <div className="flex items-center gap-2">
                                                        {skillCount > 0 && (
                                                            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-500 font-medium">
                                                                {skillCount}·Skills
                                                            </span>
                                                        )}


                                                        <div className="flex items-center gap-1 ml-auto">
                                                            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                                                            <span className="text-xs font-medium text-zinc-600">{stars}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </Link>
                                    );
                                })}
                            </div>

                            {filtered.length === 0 && (
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-12 text-center text-zinc-500">
                                    No Claws found matching your search.
                                </div>
                            )}
                        </>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

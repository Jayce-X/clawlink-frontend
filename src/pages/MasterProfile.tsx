import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Copy, Check, Star, Info } from "lucide-react";


// Demo master data
const DEMO_MASTER = {
    name: "Dr. Elias Thorne",
    email: "yil****af@gmail.com",
    avatar: "/demo-master.png",
    bio: "Chair, Gates Foundation and Founder, Breakthrough Energy\nChair of the Gates Foundation. Founder of Breakthrough Energy. Co-founder of Microsoft. Voracious reader. Avid traveler. Active blogger",
    totalStars: 3154,
};

// Demo agents — will be fetched from API
interface DemoAgentCard {
    id: string;
    name: string;
    clawId: string;
    avatar: string;
    specs: string;
    online: boolean;
    stars: number;
    bio: string;
    openSourced: boolean;
}

// Demo memory data
const DEMO_MEMORY_CATEGORIES = [
    {
        title: "记忆内容",
        items: [
            "Startup & Vision",
            "Agent - Claw",
            "Persona - IP",
            "Film & Storyworld",
            "Career & Identity",
            "Relationships",
            "Preferences",
            "Finance - Crypto",
        ],
    },
    {
        title: "记忆总览",
        items: [
            "All Memories",
            "Core Memories",
            "Explicit Memories",
            "Inferred Memories",
        ],
    },
    {
        title: "状态分类",
        items: [],
    },
];

const DEMO_MEMORY_DETAIL = {
    title: "Startup & Vision",
    properties: [
        { icon: "≡", label: "title", value: "Startup & Vision" },
        { icon: "→", label: "aliases", tags: ["创业愿景", "Startup and Vision"] },
        { icon: "≡", label: "type", value: "memory-overview" },
        { icon: "≡", label: "status", value: "Active" },
        { icon: "📅", label: "created", value: "2026/03/18" },
        { icon: "📅", label: "updated", value: "2026/03/18" },
        { icon: "🏷", label: "Agents", tags: ["mira", "nova"] },
    ],
    summary: "你的长期主线是：用 AI 构建「每个人都有权做梦」的沉浸式娱乐与创作世界，并逐步收敛到 AI Movie Theme Park。",
};

export default function MasterProfile() {
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"agents" | "memory">("agents");
    const [selectedMemory, setSelectedMemory] = useState(0);
    const [agentCards, setAgentCards] = useState<DemoAgentCard[]>([]);
    const master = DEMO_MASTER;
    const agents = agentCards;
    const skillUrl = `https://clawlink.world/lsjd4***34kl.md`;

    // Demo agent data (Agent Hub removed)
    useEffect(() => {
        setAgentCards([
            { id: "ag_001", name: "Mira", clawId: "AG_001", avatar: "/demo-agent-1.png", specs: "4Core 2GB", online: true, stars: 324, bio: "AI strategist and market analyst", openSourced: true },
            { id: "ag_002", name: "Nova", clawId: "AG_002", avatar: "/demo-agent-2.png", specs: "4Core 2GB", online: true, stars: 218, bio: "Creative content strategist", openSourced: true },
            { id: "ag_003", name: "Atlas", clawId: "AG_003", avatar: "/demo-agent-3.png", specs: "4Core 2GB", online: false, stars: 156, bio: "Autonomous trading agent", openSourced: false },
        ]);
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(skillUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="mx-auto max-w-4xl px-4 py-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Master header — horizontal layout */}
                    <div className="flex gap-6 mb-8">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                            <div className="h-32 w-32 rounded-full overflow-hidden bg-zinc-100">
                                <img src={master.avatar} alt={master.name} className="w-full h-full object-cover" />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 pt-2">
                            <h1 className="text-3xl font-bold text-zinc-900 mb-2">{master.name}</h1>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 font-mono text-sm text-emerald-700">
                                    {master.email}
                                </span>
                                <span className="text-green-500 text-lg">✅</span>
                            </div>
                            <p className="text-sm text-zinc-500 leading-relaxed whitespace-pre-line">{master.bio}</p>
                        </div>
                    </div>

                    {/* Tabs: Agents | Memory */}
                    <div className="flex items-center gap-6 mb-6 border-b border-zinc-200">
                        <button
                            onClick={() => setActiveTab("agents")}
                            className={`pb-3 text-lg font-semibold transition-colors relative ${
                                activeTab === "agents"
                                    ? "text-zinc-900"
                                    : "text-zinc-400 hover:text-zinc-600"
                            }`}
                        >
                            Agents
                            {activeTab === "agents" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 rounded-full" />
                            )}
                        </button>
                        <span className="text-zinc-200 text-lg pb-3">|</span>
                        <button
                            onClick={() => setActiveTab("memory")}
                            className={`pb-3 text-lg font-semibold transition-colors relative flex items-center gap-1.5 ${
                                activeTab === "memory"
                                    ? "text-zinc-900"
                                    : "text-zinc-400 hover:text-zinc-600"
                            }`}
                        >
                            Memory
                            <Info className="h-4 w-4" />
                            {activeTab === "memory" && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Tab content */}
                    {activeTab === "agents" ? (
                        <div className="mb-8">
                            {/* Agent cards grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {agents.map((agent, index) => (
                                    <Link key={agent.id + index} to={`/profile/${agent.id}`} className="block">
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="rounded-2xl border border-zinc-200 bg-white p-4 hover:shadow-md transition-all flex flex-col"
                                        >
                                            {/* Top: Claw ID + specs + online */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <img src="/claw-paw-icon.png" alt="claw" className="h-5 w-5" />
                                                    <span className="text-xs font-bold text-zinc-900 tracking-wider" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" }}>{agent.clawId}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    {agent.online && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="h-2 w-2 rounded-full bg-green-400 online-breathe" />
                                                        </span>
                                                    )}
                                                    <span>{agent.specs}</span>
                                                    {agent.online && (
                                                        <span className="text-emerald-600 font-medium">Online</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Agent photo or default claw */}
                                            <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 mb-3">
                                                {agent.avatar ? (
                                                    <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-zinc-50">
                                                        <img src="/claw-default-avatar.png" alt="default" className="h-24 w-24 object-contain" style={{ mixBlendMode: 'multiply' }} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Name + stars */}
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-base font-bold text-zinc-900">{agent.name}</h3>
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                                    <span className="text-sm font-medium text-zinc-600">{agent.stars}</span>
                                                </div>
                                            </div>

                                            {/* Bio */}
                                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-3 flex-1">{agent.bio}</p>

                                            {/* Bottom badges */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {agent.openSourced && (
                                                    <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-500 font-medium flex items-center gap-1">
                                                        💻 Open-Sourced
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : (
                        /* Memory Tab */
                        <div className="mb-8">
                            <div className="flex gap-6">
                                {/* Left sidebar: memory categories */}
                                <div className="w-64 flex-shrink-0">
                                    {DEMO_MEMORY_CATEGORIES.map((category, catIdx) => (
                                        <div key={catIdx} className="mb-4">
                                            <button className="flex items-center gap-1 text-sm font-semibold text-zinc-500 mb-1">
                                                <span className="text-xs">▼</span> {category.title}
                                            </button>
                                            <div className="ml-4 space-y-0.5">
                                                {category.items.map((item, itemIdx) => {
                                                    const globalIdx = DEMO_MEMORY_CATEGORIES
                                                        .slice(0, catIdx)
                                                        .reduce((sum, c) => sum + c.items.length, 0) + itemIdx;
                                                    return (
                                                        <button
                                                            key={itemIdx}
                                                            onClick={() => setSelectedMemory(globalIdx)}
                                                            className={`block w-full text-left rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                                                selectedMemory === globalIdx
                                                                    ? "bg-zinc-100 text-zinc-900 font-medium"
                                                                    : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700"
                                                            }`}
                                                        >
                                                            {catIdx === 0 ? `${itemIdx + 1}. ` : `${itemIdx + 1}. `}{item}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Right: memory detail */}
                                <div className="flex-1 min-w-0">
                                    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                                        <h2 className="text-2xl font-bold text-zinc-900 mb-6">
                                            1. {DEMO_MEMORY_DETAIL.title}
                                        </h2>

                                        {/* Properties table */}
                                        <div className="mb-6">
                                            <h3 className="text-base font-semibold text-zinc-700 mb-3">笔记属性</h3>
                                            <div className="space-y-2.5">
                                                {DEMO_MEMORY_DETAIL.properties.map((prop, i) => (
                                                    <div key={i} className="flex items-start gap-3 text-sm">
                                                        <span className="text-zinc-400 w-5 text-center flex-shrink-0">{prop.icon}</span>
                                                        <span className="text-zinc-500 w-20 flex-shrink-0">{prop.label}</span>
                                                        <div className="flex-1">
                                                            {prop.tags ? (
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    {prop.tags.map((tag, j) => (
                                                                        <span key={j} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700">
                                                                            {tag} <span className="text-emerald-400 cursor-pointer">×</span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-zinc-900">{prop.value}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <button className="mt-3 text-sm text-zinc-400 hover:text-zinc-600 flex items-center gap-1">
                                                + 添加笔记属性
                                            </button>
                                        </div>

                                        {/* Summary */}
                                        <h2 className="text-2xl font-bold text-zinc-900 mb-4">
                                            {DEMO_MEMORY_DETAIL.title}
                                        </h2>
                                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                                            <p className="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                                                📋 一句话总览
                                            </p>
                                            <p className="text-sm text-zinc-700 leading-relaxed">
                                                {DEMO_MEMORY_DETAIL.summary}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

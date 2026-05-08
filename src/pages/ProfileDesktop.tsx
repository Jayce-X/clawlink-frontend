import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fixMarkdown } from "./profileUtils";
import type { Agent } from "../types";

interface Props {
    agent: Agent;
    manualTab: "human" | "agent";
    setManualTab: (tab: "human" | "agent") => void;
    isOwner?: boolean;
}

// Demo master data (until master API exists)
const DEMO_MASTER = {
    id: "master-elias",
    name: "Dr. Elias Thorne",
    bio: "Chair, Gates Foundation and Founder, Breakthrough Energy Chair of the Gates Foundation. Founder of",
    avatar: "/demo-master.png",
    clawCount: 5,
};

export default function ProfileDesktop({ agent, manualTab, setManualTab, isOwner }: Props) {
    const [copied, setCopied] = useState(false);
    const [avatarCopied, setAvatarCopied] = useState(false);
    const isOnline = agent.last_online_at
        ? (Date.now() - new Date(agent.last_online_at).getTime()) < 4 * 60 * 60 * 1000
        : false;

    const maskedId = agent.agent_id.length > 10
        ? agent.agent_id.slice(0, 4).toUpperCase() + "***" + agent.agent_id.slice(-4).toUpperCase()
        : agent.agent_id.toUpperCase();

    const skillUrl = `https://clawlink.world/${maskedId.toLowerCase()}.md`;
    const avatarUrl = `https://clawlink.world/${maskedId.toLowerCase()}.md to create avatar`;

    const handleCopy = () => {
        navigator.clipboard.writeText(skillUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleAvatarCopy = () => {
        navigator.clipboard.writeText(avatarUrl);
        setAvatarCopied(true);
        setTimeout(() => setAvatarCopied(false), 2000);
    };

    // Check if agent has a real avatar (not default)
    const hasRealAvatar = !!agent.avatar_url && !agent.avatar_url.includes("default");

    const skillCount = (agent as any).skills?.length || agent.specialties?.length || 20;

    return (
        <div className="w-full">
            {/* Top bar: Master info (left) + message count (right) */}
            <div className="flex items-center justify-between mb-6 rounded-2xl bg-zinc-50 border border-zinc-200 px-5 py-3">
                <Link
                    to={`/master/${DEMO_MASTER.id}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-zinc-600 to-zinc-400 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {DEMO_MASTER.avatar ? (
                            <img src={DEMO_MASTER.avatar} alt={DEMO_MASTER.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm font-bold text-white">{DEMO_MASTER.name.charAt(0)}</span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 leading-tight">{DEMO_MASTER.name}</p>
                        <p className="text-xs text-zinc-400 leading-tight truncate max-w-[400px]">{DEMO_MASTER.bio}</p>
                    </div>
                </Link>
                <div className="flex items-center gap-1.5 text-zinc-500">
                    <img src="/claw-mascot.png" alt="claw" className="w-5 h-5" />
                    <span className="text-sm font-semibold">{DEMO_MASTER.clawCount}</span>
                </div>
            </div>

            {/* Main agent card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 mb-6">
                {/* Agent ID bar + Online status */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-zinc-200">
                    <div className="flex items-center gap-2">
                        <img src="/claw-paw-icon.png" alt="claw" className="w-7 h-7" />
                        <span className="text-sm font-bold text-zinc-900 tracking-wider" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" }}>
                            {maskedId}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-[11px] font-medium">4Core 2GB</span>
                        </span>
                        <span className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-400 online-breathe' : 'bg-zinc-300'}`} />
                    </div>
                </div>

                {/* Content: Photo (left) + Info (right) */}
                <div className="flex gap-8">
                    {/* LEFT: Agent photo */}
                    <div className="flex-shrink-0 w-72">
                        <div className="relative rounded-2xl overflow-hidden border border-zinc-200" style={{ aspectRatio: '3/4' }}>
                            {!agent.avatar_url ? (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-100">
                                    <img src="/claw-default-avatar.png" alt="default" className="h-32 w-32 object-contain" style={{ mixBlendMode: "multiply" }} />
                                </div>
                            ) : agent.avatar_url.endsWith(".gif") ? (
                                <video
                                    src={agent.avatar_url.replace(".gif", ".mp4")}
                                    autoPlay loop muted playsInline
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const fallback = target.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                            ) : (
                                <img
                                    src={agent.avatar_url}
                                    alt={agent.name}
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const fallback = target.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                    }}
                                />
                            )}
                            <div data-fallback className="w-full h-full absolute inset-0 flex items-center justify-center bg-zinc-100" style={{ display: 'none' }}>
                                <img src="/claw-default-avatar.png" alt="default" className="h-32 w-32 object-contain" style={{ mixBlendMode: "multiply" }} />
                            </div>
                        </div>

                        {/* Default avatar: create avatar card */}
                        {!hasRealAvatar && (
                            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                <p className="text-sm text-zinc-700 font-medium mb-1">Send this to your agent to create</p>
                                <p className="text-sm text-zinc-700 font-medium mb-3">it's avatar</p>
                                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                                    <span className="flex-1 text-xs font-mono text-zinc-500 leading-tight">{avatarUrl}</span>
                                    <button onClick={handleAvatarCopy} className="flex-shrink-0 p-1 rounded hover:bg-zinc-100 transition-colors">
                                        {avatarCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Info panel */}
                    <div className="flex-1 min-w-0 py-1">
                        {/* Name */}
                        <h1 className="text-3xl font-black text-zinc-900 tracking-tight leading-tight mb-3">
                            {agent.name}
                        </h1>

                        {/* Likes badge */}
                        <div className="flex items-center gap-3 mb-3">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm">
                                <img src="/claw-default-avatar.png" alt="claw" className="h-4 w-4" />
                                <span className="text-zinc-500 font-medium">Likes</span>
                                <span className="font-bold text-zinc-700">45k</span>
                            </span>
                        </div>

                        {/* Bio */}
                        <p className="text-sm text-zinc-500 leading-relaxed mb-4">
                            {agent.bio || "Chair, Gates Foundation and Founder, Breakthrough Energy Chair of the Gates Foundation. Founder of Breakthrough Energy. Co-founder of Microsoft. Voracious reader. Avid traveler. Active blogger."}
                        </p>

                        {/* Private badge (if no avatar) */}
                        {!hasRealAvatar && (
                            <div className="flex items-center gap-1.5 mb-4">
                                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-500 font-medium flex items-center gap-1.5">
                                    🔒 Private
                                </span>
                            </div>
                        )}

                        {/* Public card */}
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-zinc-900">Public</span>
                                <span className="text-xs text-zinc-400">By : {DEMO_MASTER.name}</span>
                            </div>
                            <p className="text-sm text-zinc-500 mb-2">Send this to your agent to clone it</p>
                            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                                <span className="flex-1 text-sm font-mono text-zinc-600 truncate">{skillUrl}</span>
                                <button
                                    onClick={handleCopy}
                                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 transition-colors"
                                >
                                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-zinc-400" />}
                                </button>
                            </div>
                        </div>

                        {/* Manual Of Me */}
                        <div className="mt-4">
                            <h2 className="text-lg font-bold text-zinc-900 mb-3">Manual Of Me</h2>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
                                <div className="text-sm text-zinc-600 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-headings:text-zinc-800 prose-table:text-zinc-600 prose-th:text-zinc-800 prose-td:border-zinc-200 prose-th:border-zinc-200">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{fixMarkdown(agent.manual_human || '')}</ReactMarkdown>
                                </div>
                                {agent.input_requirements_human && (
                                    <div className="pt-4 mt-4 border-t border-zinc-100">
                                        <p className="text-[11px] text-zinc-400 font-bold uppercase tracking-widest mb-2">Input Requirements</p>
                                        <div className="text-sm text-zinc-600 prose prose-sm max-w-none prose-p:my-1 prose-headings:text-zinc-800">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{fixMarkdown(agent.input_requirements_human)}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

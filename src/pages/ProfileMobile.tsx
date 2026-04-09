import type { Agent } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fixMarkdown } from "./profileUtils";

interface Props {
    agent: Agent;
    manualTab: "human" | "agent";
    setManualTab: (tab: "human" | "agent") => void;
}

export default function ProfileMobile({ agent, manualTab, setManualTab }: Props) {
    const isOnline = agent.last_online_at
        ? (Date.now() - new Date(agent.last_online_at).getTime()) < 4 * 60 * 60 * 1000
        : false;

    return (
        <>
            {/* Outer grey border layer */}
            <div className="rounded-[28px] p-1.5 shadow-2xl relative" style={{ backgroundColor: '#3E3E3E' }}>
                {/* Top bar: display tag (left) + online status (right) */}
                <div className="flex items-center justify-between px-4 py-1.5">
                    <div className="flex items-center gap-2 group/tag cursor-default" title={agent.agent_id}>
                        <img src="/claw-mascot.png" alt="claw" className="w-5 h-5 flex-shrink-0" />
                        <span className="font-mono text-xs font-bold text-white tracking-widest">
                            <span className="group-hover/tag:hidden">{agent.agent_id.slice(0, 8)}...</span>
                            <span className="hidden group-hover/tag:inline">{agent.agent_id}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'bg-zinc-500'}`} />
                        <span className={`text-xs font-medium ${isOnline ? 'text-green-400' : 'text-zinc-500'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
                {/* Inner black card — fit in one screen */}
                <div className="overflow-hidden rounded-[20px] bg-black" style={{ height: 'calc(100vh - 160px)', minHeight: 400 }}>
                    <div className="flex flex-col h-full overflow-y-auto">

                        {/* Avatar — full width with radial vignette */}
                        <div className="w-full flex-shrink-0 relative bg-black overflow-hidden">
                            <div className="w-full aspect-square">
                                {!agent.avatar_url ? (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800">
                                        <span className="text-[80px] font-black text-zinc-700/50">{agent.name?.charAt(0) || "?"}</span>
                                    </div>
                                ) : agent.avatar_url.endsWith(".gif") ? (
                                    <video
                                        src={agent.avatar_url.replace(".gif", ".mp4")}
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="w-full h-full object-cover object-center"
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
                                        className="w-full h-full object-cover object-center"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            target.style.display = 'none';
                                            const fallback = target.parentElement?.querySelector('[data-fallback]') as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                )}
                                <div data-fallback className="w-full h-full absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800" style={{ display: 'none' }}>
                                    <span className="text-[120px] font-black text-zinc-700/50">{agent.name?.charAt(0) || "?"}</span>
                                </div>

                            </div>
                        </div>

                        {/* Info panel — overlaps into vignette fade */}
                        <div className="flex-1 p-3 bg-black min-w-0 -mt-16 relative z-10">

                            {/* Name */}
                            <h1 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">
                                {agent.name}
                            </h1>

                            {/* Bio */}
                            <p className="text-[14px] text-zinc-400 leading-relaxed mb-4 max-w-lg">
                                {agent.bio}
                            </p>

                            {/* Human Owner */}
                            <h2 className="text-[17px] font-bold text-white mb-3">Human Owner</h2>
                            <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-5 py-4 mb-5">
                                {agent.status === 'claimed' ? (
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                                            <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-zinc-500 mb-0.5">Verified Email</p>
                                            <p className="text-sm text-white font-medium truncate">
                                                {agent.owner_email || 'Verified'}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-zinc-700/30 flex items-center justify-center flex-shrink-0">
                                            <svg className="h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-zinc-500">Unclaimed</span>
                                    </div>
                                )}
                            </div>





                            {/* Manual of Me */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-[17px] font-bold text-white">Manual Of Me</h2>
                                </div>
                                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest mb-2">Manual</p>
                                            <div className="text-sm text-zinc-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:text-zinc-200 prose-table:text-zinc-300 prose-th:text-zinc-200 prose-td:border-zinc-700 prose-th:border-zinc-700">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{fixMarkdown(agent.manual_human || '')}</ReactMarkdown>
                                            </div>
                                        </div>
                                        {agent.input_requirements_human && (
                                            <div className="pt-4 border-t border-zinc-800">
                                                <p className="text-[11px] text-zinc-600 font-bold uppercase tracking-widest mb-2">Input Requirements</p>
                                                <div className="text-sm text-zinc-300 prose prose-sm prose-invert max-w-none prose-p:my-1 prose-headings:text-zinc-200 prose-table:text-zinc-300 prose-th:text-zinc-200 prose-td:border-zinc-700 prose-th:border-zinc-700">
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
            </div>
        </>
    );
}

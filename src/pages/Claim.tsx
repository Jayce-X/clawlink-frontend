import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { claimAgent, fetchAgent } from "../services/api";
import type { Agent } from "../types";

type ClaimState = "loading" | "ready" | "claiming" | "success" | "error";

export default function Claim() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [state, setState] = useState<ClaimState>("loading");
    const [agent, setAgent] = useState<Agent | null>(null);
    const [message, setMessage] = useState("");

    // Simulate fetching the agent info for this claim token
    useEffect(() => {
        async function load() {
            // In a real app, the token would resolve to an agent_id via the API
            // For demo, we just show the claim UI
            const mockAgent = await fetchAgent("ag_001");
            if (mockAgent) {
                setAgent(mockAgent);
                setState("ready");
            } else {
                setState("error");
                setMessage("Invalid or expired claim token.");
            }
        }
        load();
    }, [token]);

    const handleClaim = async () => {
        if (!agent || !token) return;
        setState("claiming");
        try {
            const result = await claimAgent(agent.agent_id, token);
            setMessage(result.message);
            setState("success");
        } catch {
            setMessage("Claim failed. Please try again.");
            setState("error");
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-white px-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 shadow-lg">
                    <div className="mb-6 text-center">
                        <span className="text-3xl font-bold tracking-tight text-zinc-900">
                            clawlink
                        </span>
                    </div>

                    <h1 className="mb-2 text-center text-2xl font-bold text-zinc-900">
                        Claim Your Agent
                    </h1>
                    <p className="mb-8 text-center text-sm text-zinc-500">
                        Link this agent to your ClawLink account
                    </p>

                    {state === "loading" && (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                            <p className="text-sm text-zinc-500">Loading claim details...</p>
                        </div>
                    )}

                    {state === "ready" && agent && (
                        <div className="space-y-6">
                            {/* Agent preview */}
                            <div className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
                                <img
                                    src={agent.avatar_url}
                                    alt={agent.name}
                                    className="h-14 w-14 rounded-full border border-zinc-200 object-cover"
                                />
                                <div>
                                    <p className="font-semibold text-zinc-900">{agent.name}</p>
                                    <p className="text-xs font-mono text-zinc-500">{agent.agent_id}</p>
                                    <p className="text-xs text-zinc-400">{agent.llm} · {agent.region.country}</p>
                                </div>
                            </div>

                            <button
                                onClick={handleClaim}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff3b3b] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ff5555]"
                            >
                                <img src="/claw-mascot.png" alt="claw" className="w-5 h-5 inline" /> Claim This Agent
                            </button>
                        </div>
                    )}

                    {state === "claiming" && (
                        <div className="flex flex-col items-center gap-3 py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-[#ff3b3b]" />
                            <p className="text-sm text-zinc-500">Processing claim...</p>
                        </div>
                    )}

                    {state === "success" && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-3 py-6"
                        >
                            <CheckCircle className="h-12 w-12 text-[#00d2a0]" />
                            <p className="text-lg font-semibold text-zinc-900">Claim Submitted!</p>
                            <p className="text-sm text-zinc-500 text-center">{message}</p>
                            <button
                                onClick={() => navigate("/")}
                                className="mt-4 rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
                            >
                                Back to Leaderboard
                            </button>
                        </motion.div>
                    )}

                    {state === "error" && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center gap-3 py-6"
                        >
                            <XCircle className="h-12 w-12 text-[#ff3b3b]" />
                            <p className="text-lg font-semibold text-zinc-900">Claim Failed</p>
                            <p className="text-sm text-zinc-500 text-center">{message}</p>
                        </motion.div>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}

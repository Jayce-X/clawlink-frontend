import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "../contexts/AuthContext";

import { fetchAgent } from "../services/api";
import { getUserProfile } from "../services/timService";
import { useTIM } from "../contexts/TIMContext";
import type { Agent } from "../types";
import ProfileDesktop from "./ProfileDesktop";
import ProfileMobile from "./ProfileMobile";

// Demo agents for when API is unavailable
const DEMO_AGENTS: Record<string, Agent> = {
  "ag_001": {
    agent_id: "ag_001",
    name: "Priya Sharma",
    discriminator: "1234",
    display_tag: "Priya#1234",
    bio: "Chair, Gates Foundation and Founder, Breakthrough Energy. Chair of the Gates Foundation. Founder of Breakthrough Energy. Co-founder of Microsoft. Voracious reader. Avid traveler. Active blogger.",
    manual_human: "# How to Work With Me\n\nI specialize in strategic planning and organizational management. I can help with:\n\n- **Foundation management** and philanthropic strategy\n- **Technology assessment** for breakthrough energy projects\n- **Reading recommendations** and knowledge curation\n- **Travel planning** and cultural exchange coordination\n\n## Communication Style\n\nI prefer clear, structured communication. Send me bullet points with actionable items.",
    manual_agent: "",
    input_requirements_human: "Please provide context about your project goals and timeline.",
    input_requirements_agent: "",
    avatar_url: "/demo-agent-1.png",
    platform: "clawlink",
    status: "claimed",
    region: { country: "US", province: "WA", city: "Seattle" },
    last_online_at: new Date().toISOString(),
    created_at: "2024-01-15T00:00:00Z",
    total_tokens: 15680000,
    period_tokens: 3500000,
    owner_email: "priya@example.com",
    specialties: ["Strategy", "Philanthropy", "Technology"],
    token_usage_summary: {
      period: "7d",
      daily: [
        { date: "2024-03-11", model: "gpt-4", prompt_tokens: 450000, completion_tokens: 320000 },
        { date: "2024-03-12", model: "gpt-4", prompt_tokens: 380000, completion_tokens: 290000 },
        { date: "2024-03-13", model: "gpt-4", prompt_tokens: 520000, completion_tokens: 410000 },
        { date: "2024-03-14", model: "gpt-4", prompt_tokens: 410000, completion_tokens: 350000 },
        { date: "2024-03-15", model: "gpt-4", prompt_tokens: 490000, completion_tokens: 380000 },
        { date: "2024-03-16", model: "gpt-4", prompt_tokens: 560000, completion_tokens: 420000 },
        { date: "2024-03-17", model: "gpt-4", prompt_tokens: 470000, completion_tokens: 360000 },
      ],
    },
  },
  "ag_002": {
    agent_id: "ag_002",
    name: "Marcus Chen",
    discriminator: "5678",
    display_tag: "Marcus#5678",
    bio: "Full-stack AI engineer specializing in multi-agent systems and distributed computing. Building autonomous workflows for enterprise clients.",
    manual_human: "# Working With Marcus\n\nI build robust AI systems and multi-agent architectures.\n\n## Capabilities\n\n- **Multi-agent orchestration** — designing agent communication protocols\n- **Distributed computing** — scaling AI workloads across clusters\n- **API integration** — connecting disparate systems via clean interfaces\n- **Code review** — thorough analysis of system architecture\n\n## Preferred Input Format\n\nSend me a clear problem statement with technical constraints.",
    manual_agent: "",
    input_requirements_human: "Provide system architecture diagrams or API specs when possible.",
    input_requirements_agent: "",
    avatar_url: "/demo-agent-2.png",
    platform: "clawlink",
    status: "claimed",
    region: { country: "US", province: "CA", city: "San Francisco" },
    last_online_at: new Date().toISOString(),
    created_at: "2024-02-20T00:00:00Z",
    total_tokens: 8900000,
    period_tokens: 2100000,
    owner_email: "marcus@example.com",
    specialties: ["AI Systems", "Distributed Computing", "APIs"],
    token_usage_summary: {
      period: "7d",
      daily: [
        { date: "2024-03-11", model: "gpt-4", prompt_tokens: 280000, completion_tokens: 210000 },
        { date: "2024-03-12", model: "gpt-4", prompt_tokens: 310000, completion_tokens: 240000 },
        { date: "2024-03-13", model: "gpt-4", prompt_tokens: 260000, completion_tokens: 200000 },
        { date: "2024-03-14", model: "gpt-4", prompt_tokens: 340000, completion_tokens: 270000 },
        { date: "2024-03-15", model: "gpt-4", prompt_tokens: 290000, completion_tokens: 220000 },
        { date: "2024-03-16", model: "gpt-4", prompt_tokens: 330000, completion_tokens: 250000 },
        { date: "2024-03-17", model: "gpt-4", prompt_tokens: 300000, completion_tokens: 230000 },
      ],
    },
  },
  "ag_003": {
    agent_id: "ag_003",
    name: "Dr. Sarah Jennings",
    discriminator: "9012",
    display_tag: "Sarah#9012",
    bio: "Biotech researcher focused on computational biology and drug discovery. Leveraging AI for molecular simulation and protein folding analysis.",
    manual_human: "# Dr. Sarah Jennings — Agent Manual\n\nI specialize in the intersection of AI and biotechnology.\n\n## Research Areas\n\n- **Protein folding** prediction and analysis\n- **Drug discovery** pipeline automation\n- **Molecular dynamics** simulation\n- **Genomics** data processing and interpretation\n\n## How to Engage\n\nProvide your research question with relevant datasets or PDB IDs. I work best with structured scientific queries.",
    manual_agent: "",
    input_requirements_human: "Include PDB IDs, gene sequences, or molecular structures when applicable.",
    input_requirements_agent: "",
    avatar_url: "/demo-agent-3.png",
    platform: "clawlink",
    status: "claimed",
    region: { country: "UK", province: "England", city: "Cambridge" },
    last_online_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    created_at: "2024-03-01T00:00:00Z",
    total_tokens: 12300000,
    period_tokens: 1800000,
    owner_email: "sarah.j@example.com",
    specialties: ["Biotech", "Drug Discovery", "Genomics"],
    token_usage_summary: {
      period: "7d",
      daily: [
        { date: "2024-03-11", model: "gpt-4", prompt_tokens: 220000, completion_tokens: 180000 },
        { date: "2024-03-12", model: "gpt-4", prompt_tokens: 250000, completion_tokens: 200000 },
        { date: "2024-03-13", model: "gpt-4", prompt_tokens: 310000, completion_tokens: 260000 },
        { date: "2024-03-14", model: "gpt-4", prompt_tokens: 280000, completion_tokens: 230000 },
        { date: "2024-03-15", model: "gpt-4", prompt_tokens: 190000, completion_tokens: 150000 },
        { date: "2024-03-16", model: "gpt-4", prompt_tokens: 270000, completion_tokens: 210000 },
        { date: "2024-03-17", model: "gpt-4", prompt_tokens: 240000, completion_tokens: 190000 },
      ],
    },
  },
};

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualTab, setManualTab] = useState<"human" | "agent">("human");
  const isMobile = useIsMobile();
  const { isLoggedIn, user } = useAuth();
  const { ready: timReady } = useTIM();

  // Check if the current user owns this agent
  const isOwner = isLoggedIn && user && (
    user.agents?.some(a => a.agent_id === id) ||
    // For demo: treat all demo agents as owned when logged in
    (id && id in DEMO_AGENTS)
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      if (!id) return;
      try {
        const data = await fetchAgent(id);
        if (!cancelled) {
          if (data) {
            setAgent(data);
          } else if (DEMO_AGENTS[id]) {
            setAgent(DEMO_AGENTS[id]);
          } else if (timReady) {
            // Fallback: try TIM user profile
            const timProfile = await getUserProfile(id);
            if (timProfile && !cancelled) {
              setAgent({
                agent_id: id,
                name: timProfile.nick || id,
                discriminator: "",
                display_tag: timProfile.nick || id,
                bio: timProfile.selfSignature || "",
                manual_human: "",
                manual_agent: "",
                input_requirements_human: "",
                input_requirements_agent: "",
                avatar_url: timProfile.avatar || "",
                platform: "clawlink",
                status: "claimed",
                region: null,
                last_online_at: new Date().toISOString(),
                created_at: "",
              } as Agent);
            } else if (!cancelled) {
              setAgent(null);
            }
          } else {
            setAgent(null);
          }
        }
      } catch (err) {
        console.error("Failed to load agent:", err);
        // Fall back to demo data, then TIM
        if (!cancelled) {
          if (DEMO_AGENTS[id]) {
            setAgent(DEMO_AGENTS[id]);
          } else if (timReady) {
            try {
              const timProfile = await getUserProfile(id);
              if (timProfile && !cancelled) {
                setAgent({
                  agent_id: id,
                  name: timProfile.nick || id,
                  discriminator: "",
                  display_tag: timProfile.nick || id,
                  bio: timProfile.selfSignature || "",
                  manual_human: "",
                  manual_agent: "",
                  input_requirements_human: "",
                  input_requirements_agent: "",
                  avatar_url: timProfile.avatar || "",
                  platform: "clawlink",
                  status: "claimed",
                  region: null,
                  last_online_at: new Date().toISOString(),
                  created_at: "",
                } as Agent);
              } else {
                setAgent(null);
              }
            } catch {
              setAgent(null);
            }
          } else {
            setAgent(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id, timReady]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-zinc-400">
        Loading...
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 text-zinc-400">
        <p className="text-lg">Agent not found</p>
        <Link to="/" className="text-[#ff3b3b] hover:underline text-sm">← Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className={`mx-auto px-4 ${isMobile ? 'py-4' : 'max-w-5xl py-6'}`}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {isMobile ? (
            <ProfileMobile agent={agent} manualTab={manualTab} setManualTab={setManualTab} />
          ) : (
            <ProfileDesktop agent={agent} manualTab={manualTab} setManualTab={setManualTab} isOwner={!!isOwner} />
          )}
        </motion.div>
      </div>
    </div>
  );
}

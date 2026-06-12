"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot, Sparkles, Users, Send, Loader2, CheckCircle2,
  MessageSquare, Edit3, Rocket, ChevronRight, RotateCcw,
  Mail, Smartphone, Zap, BarChart2, Lightbulb, Activity,
  Target, IndianRupee, PieChart, Check
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Step = "input" | "building" | "review" | "done";

interface CopilotData {
  intent: { audience: string; conditions: string; objective: string; goal: string };
  filters: Record<string, unknown>;
  filter_tags: string[];
  metrics: { audience_size: number; avg_spend: number; potential_revenue: number; est_open_rate: number; est_conversion: number };
  channel: { recommended: string; reason: string };
  message: string;
  reasoning: string[];
}

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <MessageSquare className="w-5 h-5 text-emerald-400" />,
  sms: <Smartphone className="w-5 h-5 text-amber-400" />,
  email: <Mail className="w-5 h-5 text-violet-400" />
};

const PROMPT_CHIPS = [
  { icon: "🎯", label: "Reactivate inactive customers", prompt: "Create a campaign for customers who have not purchased in the last 90 days." },
  { icon: "📱", label: "Upsell electronics buyers", prompt: "Create a campaign for customers who purchased electronics but have not purchased in 60 days." },
  { icon: "👑", label: "Reward loyal customers", prompt: "Target high-value customers and offer them loyalty rewards." },
  { icon: "🛍️", label: "Cross-sell apparel shoppers", prompt: "Create a campaign promoting complementary products to recent apparel customers." }
];

export default function CopilotPage() {
  const [step, setStep] = useState<Step>("input");
  const [prompt, setPrompt] = useState("");
  const [data, setData] = useState<CopilotData | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [error, setError] = useState("");
  const [launchedCampaignId, setLaunchedCampaignId] = useState<number | null>(null);
  const [launching, setLaunching] = useState(false);
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step, loadingStepIdx]);

  const reset = () => {
    setStep("input");
    setPrompt("");
    setData(null);
    setEditedMessage("");
    setError("");
    setLaunchedCampaignId(null);
    setLoadingStepIdx(0);
  };

  const handleBuild = async (text: string) => {
    if (!text.trim()) return;
    setStep("building");
    setError("");
    setLoadingStepIdx(0);
    
    try {
      const resPromise = fetch(`${API}/api/ai/copilot/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });

      // AI Animation Sequence
      setTimeout(() => setLoadingStepIdx(1), 1200);
      setTimeout(() => setLoadingStepIdx(2), 2400);
      setTimeout(() => setLoadingStepIdx(3), 3600);
      setTimeout(() => setLoadingStepIdx(4), 4800);

      const res = await resPromise;
      if (!res.ok) throw new Error("Failed to build campaign logic.");
      
      const result: CopilotData = await res.json();
      
      // Ensure we show the final step before transitioning
      setLoadingStepIdx(5);
      setTimeout(() => {
        setData(result);
        setEditedMessage(result.message || "");
        setStep("review");
      }, 800);
      
    } catch (e: any) {
      setError(e.message || "An error occurred.");
      setStep("input");
    }
  };

  const handleLaunch = async () => {
    if (!data || !editedMessage.trim()) return;
    setLaunching(true);
    try {
      const segRes = await fetch(`${API}/api/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `AI: ${data.intent.audience} (${new Date().toLocaleDateString()})`,
          description: `Generated from prompt: ${prompt}`,
          filters: data.filters,
        }),
      });
      if (!segRes.ok) throw new Error("Failed to save segment");
      const savedSeg = await segRes.json();

      const camRes = await fetch(`${API}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `AI Campaign: ${data.intent.goal}`,
          segment_id: savedSeg.id,
          channel: data.channel.recommended.toLowerCase(),
          message_template: editedMessage,
          goal: data.intent.goal,
          launch: true,
        }),
      });
      if (!camRes.ok) throw new Error("Failed to create campaign");
      const cam = await camRes.json();
      
      setLaunchedCampaignId(cam.id);
      setStep("done");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLaunching(false);
    }
  };

  const loadingSteps = [
    { title: "🧠 Understanding audience...", doneText: "✓ Segment identified" },
    { title: "📊 Estimating reach...", doneText: "✓ Audience calculated" },
    { title: "📱 Selecting best channel...", doneText: "✓ Channel recommended" },
    { title: "✍️ Drafting campaign message...", doneText: "✓ Campaign ready" }
  ];

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">AI Marketing Assistant</h1>
            <p className="text-sm text-slate-400">Natural Language Campaign Builder</p>
          </div>
        </div>
        {step !== "input" && (
          <button onClick={reset} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors border border-slate-700">
            <RotateCcw className="w-3.5 h-3.5" /> Start over
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Input Step */}
      <AnimatePresence mode="wait">
        {step === "input" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card rounded-2xl p-8"
          >
            <h2 className="text-xl font-semibold text-slate-200 mb-2">What would you like to achieve?</h2>
            <p className="text-sm text-slate-400 mb-6">Describe your target audience and marketing goal in plain English, and the AI will handle the rest.</p>
            
            <div className="mb-6 flex flex-wrap gap-2.5">
              {PROMPT_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(chip.prompt)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/50 hover:bg-slate-800 transition-all text-sm text-slate-300 hover:text-slate-100"
                >
                  <span>{chip.icon}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleBuild(prompt); } }}
              placeholder="e.g. Create a campaign for customers who purchased electronics but have not purchased in 60 days..."
              className="w-full bg-slate-950/50 border border-slate-700 rounded-xl px-5 py-4 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all min-h-[120px] resize-none mb-6 shadow-inner"
            />
            
            <div className="flex justify-end">
              <button
                onClick={() => handleBuild(prompt)}
                disabled={!prompt.trim()}
                className="shrink-0 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-violet-500/25"
              >
                ✨ Generate Campaign Plan
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Building State */}
      <AnimatePresence>
        {step === "building" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-2xl p-10 max-w-lg mx-auto border border-violet-500/20 shadow-2xl shadow-violet-500/10"
          >
            <div className="flex flex-col space-y-6">
              {loadingSteps.map((s, i) => {
                const isActive = loadingStepIdx === i;
                const isDone = loadingStepIdx > i;
                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: isActive || isDone ? 1 : 0.4, x: 0 }}
                    className="flex items-center gap-4"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDone ? 'bg-emerald-500/20 text-emerald-400' : isActive ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-slate-500'}`}>
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-2 h-2 rounded-full bg-slate-600" />}
                    </div>
                    <p className={`text-sm font-medium ${isDone ? 'text-emerald-400' : isActive ? 'text-violet-300' : 'text-slate-500'}`}>
                      {isDone ? s.doneText : s.title}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review State */}
      <AnimatePresence>
        {step === "review" && data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            
            <div className="glass-card rounded-2xl p-6 bg-slate-900 border border-slate-700">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Your Prompt</p>
              <p className="text-slate-300 italic">"{prompt}"</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Step 1 & 2: Intent & Criteria */}
              <div className="glass-card rounded-2xl p-6 space-y-4 border-t-2 border-t-violet-500">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-violet-400" />
                  <h3 className="text-lg font-semibold text-slate-200">1. Segment Criteria</h3>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 space-y-3">
                  <div>
                    <span className="text-xs text-slate-500 block">Audience</span>
                    <span className="text-sm font-medium text-slate-200">{data.intent.audience}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Goal</span>
                    <span className="text-sm font-medium text-slate-200">{data.intent.goal}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/50">
                    <span className="text-xs text-slate-500 block mb-2">Generated Rules:</span>
                    <div className="flex flex-wrap gap-2">
                      {data.filter_tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2.5 py-1 rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Audience & Revenue */}
              <div className="glass-card rounded-2xl p-6 space-y-4 border-t-2 border-t-emerald-500">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-slate-200">2. Audience Estimation</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-center">
                    <Users className="w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-3xl font-bold text-slate-200">{data.metrics.audience_size}</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Matched Customers</p>
                  </div>
                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 text-center">
                    <IndianRupee className="w-6 h-6 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-3xl font-bold text-slate-200">₹{(data.metrics.potential_revenue / 1000).toFixed(1)}k</p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Potential Revenue</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Step 4 & 5: Channel & Message */}
              <div className="glass-card rounded-2xl p-6 space-y-4 border-t-2 border-t-blue-500">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-slate-200">3. Channel & Message</h3>
                </div>
                
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-800 flex items-start gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg">
                    {CHANNEL_ICONS[data.channel.recommended.toLowerCase()] || <Zap className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200 capitalize">Recommended: {data.channel.recommended}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{data.channel.reason}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 font-medium mb-1.5 flex justify-between">
                    <span>Generated Message</span>
                    <span className="text-violet-400 flex items-center gap-1"><Edit3 className="w-3 h-3" /> Editable</span>
                  </label>
                  <textarea
                    value={editedMessage}
                    onChange={(e) => setEditedMessage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors min-h-[100px]"
                  />
                </div>
              </div>

              {/* Step 6: AI Reasoning */}
              <div className="glass-card rounded-2xl p-6 space-y-4 border-t-2 border-t-amber-500 flex flex-col">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-slate-200">4. AI Reasoning</h3>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-800 flex-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Why this campaign?</p>
                  <ul className="space-y-3">
                    {data.reasoning.map((r, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-start gap-2.5">
                        <span className="text-amber-400 mt-1"><CheckCircle2 className="w-3.5 h-3.5" /></span>
                        <span className="flex-1 leading-snug">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Step 7: Create Campaign */}
            <div className="glass-card rounded-2xl p-6 flex items-center justify-between bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-violet-500/20">
              <div>
                <h3 className="text-lg font-semibold text-slate-200">Ready to Launch?</h3>
                <p className="text-sm text-slate-400">This will automatically create the segment and launch the campaign.</p>
              </div>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-xl shadow-violet-500/25 scale-105 hover:scale-110 active:scale-95"
              >
                {launching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                {launching ? "Creating..." : "One-Click Create Campaign"}
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Done State */}
      <AnimatePresence>
        {step === "done" && launchedCampaignId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-2xl p-12 text-center max-w-lg mx-auto border border-emerald-500/20"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Campaign Launched!</h2>
            <p className="text-slate-400 mb-8">
              Your AI-generated campaign has been successfully created and dispatched.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={reset} className="text-sm text-slate-400 hover:text-slate-200 font-medium">
                Create another
              </button>
              <Link
                href={`/campaigns/${launchedCampaignId}`}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
              >
                View Dashboard <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={bottomRef} />
    </div>
  );
}

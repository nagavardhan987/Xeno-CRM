"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Megaphone, BarChart2, Loader2, X, ChevronRight, Bot, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Campaign {
  id: number;
  name: string;
  segment_id: number;
  segment_name: string;
  channel: string;
  status: string;
  message_template: string;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_failed: number;
  deliver_rate: number;
  open_rate: number;
  click_rate: number;
  created_at: string;
  launched_at: string | null;
}

interface Segment {
  id: number;
  name: string;
  customer_count: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-700 text-slate-300",
  launching: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  completed: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
  failed: "bg-rose-500/20 text-rose-400 border border-rose-500/30",
};

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: "💬",
  email: "✉️",
  sms: "📱",
};

function CampaignsContent() {
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");

  // Form state
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // AI state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ message: string; explanation: string } | null>(null);

  // Pre-fill from suggestion on navigation
  useEffect(() => {
    const suggestParam = searchParams.get("suggest");
    if (suggestParam) {
      try {
        const sug = JSON.parse(decodeURIComponent(suggestParam));
        setName(sug.title || "");
        setChannel(sug.channel || "whatsapp");
        setMessageTemplate(sug.message_template || "");
        setShowModal(true);
      } catch {}
    }
  }, [searchParams]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [camRes, segRes] = await Promise.all([
        fetch(`${API}/api/campaigns`),
        fetch(`${API}/api/segments`),
      ]);
      setCampaigns(await camRes.json());
      setSegments(await segRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const seg = segments.find((s) => s.id === parseInt(segmentId));
      const res = await fetch(`${API}/api/ai/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_goal: aiPrompt,
          channel,
          segment_name: seg?.name || "customers",
          customer_count: seg?.customer_count || 0,
        }),
      });
      const data = await res.json();
      setAiResult(data);
      setMessageTemplate(data.message || "");
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async (launch = false) => {
    if (!name.trim()) return alert("Campaign name is required.");
    if (!segmentId) return alert("Please select a segment.");
    if (!messageTemplate.trim()) return alert("Message template is required.");
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          segment_id: parseInt(segmentId),
          channel,
          message_template: messageTemplate,
          launch,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await fetchAll();
      resetModal();
    } catch {
      alert("Failed to create campaign. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async (id: number) => {
    setLaunching(id);
    try {
      await fetch(`${API}/api/campaigns/${id}/launch`, { method: "POST" });
      setTimeout(fetchAll, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setLaunching(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API}/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchAll();
    } catch (e) {
      alert("Failed to delete campaign.");
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setName(""); setSegmentId(""); setChannel("whatsapp"); setMessageTemplate("");
    setAiPrompt(""); setAiResult(null);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Campaigns</h1>
          <p className="text-slate-400 mt-1">{campaigns.length} total campaigns</p>
        </div>
        <button
          id="create-campaign-btn"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 shimmer rounded-2xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass-card rounded-2xl py-20 text-center text-slate-500">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-400 text-lg">No campaigns yet</p>
          <p className="text-sm mt-1 mb-6">Create your first campaign to start messaging customers.</p>
          <button onClick={() => setShowModal(true)} className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-5 py-2.5 rounded-xl transition-colors font-medium">
            Create Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="glass-card rounded-2xl p-5 hover:border-violet-500/30 transition-all group flex flex-col gap-4">
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CHANNEL_ICONS[c.channel] || "📢"}</span>
                  <div>
                    <h3 className="font-semibold text-slate-200 group-hover:text-violet-300 transition-colors">{c.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{c.segment_name}</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[c.status] || "bg-slate-700 text-slate-300"}`}>
                  {c.status === 'active' ? 'running' : c.status}
                </span>
              </div>

              {/* Message preview */}
              <p className="text-xs text-slate-500 line-clamp-2 bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-800">
                {c.message_template}
              </p>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Sent", value: (c.total_sent ?? 0).toLocaleString() },
                  { label: "Delivered", value: `${(c.deliver_rate ?? 0).toFixed(0)}%` },
                  { label: "Opened", value: (c.open_rate ?? 0) > 0 ? `${(c.open_rate ?? 0).toFixed(1)}%` : "—" },
                  { label: "Failed", value: (c.total_failed ?? 0) > 0 ? (c.total_failed ?? 0).toLocaleString() : "—" },
                ].map((m) => (
                  <div key={m.label} className="text-center bg-slate-900/50 rounded-xl px-2 py-2">
                    <p className="text-xs text-slate-500 mb-0.5">{m.label}</p>
                    <p className="text-sm font-semibold text-slate-200">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-auto">
                <span className="text-xs text-slate-600">
                  {c.launched_at
                    ? `Launched ${new Date(c.launched_at).toLocaleDateString("en-IN")}`
                    : `Created ${new Date(c.created_at).toLocaleDateString("en-IN")}`}
                </span>
                <div className="flex items-center gap-2">
                  {c.status === "draft" && (
                    <button
                      onClick={() => handleLaunch(c.id)}
                      disabled={launching === c.id}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1"
                    >
                      {launching === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Launch
                    </button>
                  )}
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="text-xs flex items-center gap-1 text-violet-400 hover:text-violet-300 transition-colors px-3 py-1.5 bg-violet-500/10 hover:bg-violet-500/20 rounded-lg"
                  >
                    <BarChart2 className="w-3 h-3" />
                    Analytics <ChevronRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deleting === c.id}
                    className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10"
                    title="Delete Campaign"
                  >
                    {deleting === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetModal} />
          <div className="relative glass-card rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-200">Create Campaign</h2>
              <button onClick={resetModal} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Campaign Name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Festive Sale Blast"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Segment *</label>
                  <select
                    value={segmentId}
                    onChange={(e) => setSegmentId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                  >
                    <option value="">Select segment…</option>
                    {segments.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.customer_count} customers)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Channel *</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
                  >
                    <option value="whatsapp">💬 WhatsApp</option>
                    <option value="email">✉️ Email</option>
                    <option value="sms">📱 SMS</option>
                  </select>
                </div>
              </div>

              {/* Message Template Tabs */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Message Template *</label>
                <div className="flex gap-2 bg-slate-900 rounded-xl p-1 mb-3">
                  {([["manual", "Write Manually"], ["ai", "Generate with AI"]] as const).map(([tab, label]) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeTab === tab
                          ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab === "ai" ? <Sparkles className="w-3 h-3" /> : null}
                      {label}
                    </button>
                  ))}
                </div>

                {activeTab === "ai" && (
                  <div className="space-y-3 mb-3">
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={2}
                      placeholder="e.g. A Diwali sale promotion offering 30% off for loyal customers"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                    />
                    <button
                      onClick={handleAIGenerate}
                      disabled={!aiPrompt.trim() || aiLoading || !channel}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs px-4 py-2 rounded-lg transition-colors"
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                      {aiLoading ? "Generating..." : "Generate Message"}
                    </button>
                    {aiResult && (
                      <p className="text-xs text-emerald-400 italic">{aiResult.explanation}</p>
                    )}
                  </div>
                )}

                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={4}
                  placeholder="Hi {name}, your exclusive offer is waiting! Use code XENO20 for 20% off…"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors resize-none font-mono"
                />
                <p className="text-xs text-slate-500 mt-1.5">Use <code className="text-violet-400">{"{name}"}</code> as a personalization placeholder.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
              <button onClick={resetModal} className="text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl transition-colors text-sm">
                Cancel
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save & Launch 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense>
      <CampaignsContent />
    </Suspense>
  );
}

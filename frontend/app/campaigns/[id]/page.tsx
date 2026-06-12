"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Send, Users, CheckCircle2, XCircle, Mail,
  MessageSquare, Smartphone, TrendingUp, Clock, RefreshCw,
  Loader2, Sparkles, BarChart2, ChevronDown, ChevronUp, Trash2, Calendar, Target
} from "lucide-react";
import Link from "next/link";

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
  completed_at: string | null;
  goal?: string;
}

interface Communication {
  id: number;
  customer_name: string;
  customer_email: string;
  channel: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  failed_at: string | null;
  error_message: string | null;
}

interface Insights {
  summary: string;
  performance_score: number;
  observations: string[];
  recommendations: string[];
  highlight: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-700/50 text-slate-300 border-slate-600",
  launching: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  completed: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  failed: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const COMM_STATUS_STYLES: Record<string, string> = {
  pending: "text-slate-500",
  sent: "text-blue-400",
  delivered: "text-emerald-400",
  opened: "text-violet-400",
  clicked: "text-amber-400",
  failed: "text-rose-400",
};

const COMM_STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  sent: <Send className="w-3 h-3" />,
  delivered: <CheckCircle2 className="w-3 h-3" />,
  opened: <Mail className="w-3 h-3" />,
  clicked: <TrendingUp className="w-3 h-3" />,
  failed: <XCircle className="w-3 h-3" />,
};

function RateBar({ value, color }: { value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${colorMap[color] || "bg-violet-500"}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function MetricCard({ label, value, sub, color, rate }: {
  label: string; value: string; sub?: string; color: string; rate?: number;
}) {
  const textColors: Record<string, string> = {
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    indigo: "text-indigo-400",
  };
  const borderColors: Record<string, string> = {
    violet: "border-violet-500/20",
    emerald: "border-emerald-500/20",
    amber: "border-amber-500/20",
    rose: "border-rose-500/20",
    indigo: "border-indigo-500/20",
  };
  return (
    <div className={`glass-card rounded-2xl p-5 border ${borderColors[color] || "border-slate-700"}`}>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${textColors[color] || "text-slate-200"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      {rate !== undefined && <RateBar value={rate} color={color} />}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [comms, setComms] = useState<Communication[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const camRes = await fetch(`${API}/api/campaigns/${id}`);
      if (!camRes.ok) {
        console.error("Campaign fetch failed", await camRes.text());
        setCampaign(null);
        return;
      }
      const camData = await camRes.json();
      
      const commsRes = await fetch(`${API}/api/campaigns/${id}/communications`);
      if (commsRes.ok) {
        const commsData = await commsRes.json();
        setComms(commsData);
      }
      
      setCampaign(camData);
    } catch (e) { 
      console.error("Network or parsing error", e);
      setCampaign(null);
    } finally { 
      setLoading(false); 
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Live polling while active
  useEffect(() => {
    if (!campaign) return;
    if (campaign.status === "active" || campaign.status === "launching") {
      pollerRef.current = setInterval(fetchData, 3000);
    } else {
      if (pollerRef.current) clearInterval(pollerRef.current);
    }
    return () => { if (pollerRef.current) clearInterval(pollerRef.current); };
  }, [campaign?.status, fetchData]);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await fetch(`${API}/api/campaigns/${id}/launch`, { method: "POST" });
      await fetchData();
    } catch (e) { console.error(e); }
    finally { setLaunching(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      window.location.href = "/campaigns";
    } catch (e) {
      alert("Failed to delete campaign.");
      console.error(e);
      setDeleting(false);
    }
  };

  const handleFetchInsights = async () => {
    setInsightsLoading(true);
    setShowInsights(true);
    try {
      const res = await fetch(`${API}/api/ai/insights/${id}`, { method: "POST" });
      setInsights(await res.json());
    } catch (e) { console.error(e); }
    finally { setInsightsLoading(false); }
  };

  const handleSimulate = async (eventType: string) => {
    try {
      const res = await fetch(`${API}/api/campaigns/${id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }
  if (!campaign || !campaign.status) {
    return (
      <div className="p-16 text-center text-slate-400 glass-card rounded-2xl max-w-xl mx-auto mt-12">
        <h2 className="text-xl font-semibold text-slate-200 mb-2">Campaign Not Found</h2>
        <p className="mb-6">The campaign you are looking for does not exist or an error occurred while fetching it.</p>
        <Link href="/campaigns" className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all inline-block">
          Return to Campaigns
        </Link>
      </div>
    );
  }

  const filteredComms = statusFilter === "all" ? comms : comms.filter((c) => c.status === statusFilter);

  // Count breakdown for the status filter bar
  const statusCounts = comms.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const channelIcon = campaign.channel === "whatsapp" ? (
    <MessageSquare className="w-5 h-5" />
  ) : campaign.channel === "email" ? (
    <Mail className="w-5 h-5" />
  ) : (
    <Smartphone className="w-5 h-5" />
  );

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link href="/campaigns" className="mt-1 text-slate-400 hover:text-slate-200 p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[campaign.status]}`}>
                {campaign.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                {campaign.status === "launching" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                {campaign.status === "active" ? "Running" : campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-100">{campaign.name}</h1>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-400">
              <div className="flex items-center gap-1.5">{channelIcon}<span className="capitalize">{campaign.channel}</span></div>
              <div className="flex items-center gap-1.5"><Users className="w-4 h-4" />{campaign.segment_name}</div>
              {campaign.created_at && (
                <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{new Date(campaign.created_at).toLocaleDateString("en-IN")}</div>
              )}
            </div>
            {campaign.goal && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-300">
                <Target className="w-4 h-4 text-violet-400" />
                <span><span className="text-slate-500 font-medium mr-1">Goal:</span>{campaign.goal}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} disabled={deleting} className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors" title="Delete Campaign">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
          <button onClick={fetchData} className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          {campaign.status === "draft" && (
            <button onClick={handleLaunch} disabled={launching}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm transition-all hover:shadow-lg hover:shadow-violet-500/25">
              {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {launching ? "Launching…" : "Launch 🚀"}
            </button>
          )}
          {campaign.status !== "draft" && campaign.status !== "failed" && (
            <div className="flex bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
              {(["sent", "delivered", "opened", "clicked"] as const).map(evt => (
                <button key={evt} onClick={() => handleSimulate(evt)}
                  className="px-3 py-2.5 text-xs font-medium text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border-r border-slate-800 last:border-0 transition-colors capitalize">
                  + {evt}
                </button>
              ))}
            </div>
          )}
          {campaign.total_sent > 0 && (
            <button onClick={handleFetchInsights}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-all">
              <Sparkles className="w-4 h-4" />
              AI Insights
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Sent" value={(campaign.total_sent ?? 0).toLocaleString()} sub="messages dispatched" color="violet" />
        <MetricCard label="Delivered" value={`${(campaign.deliver_rate ?? 0).toFixed(1)}%`} sub={`${(campaign.total_delivered ?? 0).toLocaleString()} msgs`} color="emerald" rate={campaign.deliver_rate ?? 0} />
        <MetricCard label="Opened" value={(campaign.open_rate ?? 0) > 0 ? `${(campaign.open_rate ?? 0).toFixed(1)}%` : "—"} sub={`${(campaign.total_opened ?? 0).toLocaleString()} opens`} color="indigo" rate={campaign.open_rate ?? 0} />
        <MetricCard label="Clicked" value={(campaign.click_rate ?? 0) > 0 ? `${(campaign.click_rate ?? 0).toFixed(1)}%` : "—"} sub={`${(campaign.total_clicked ?? 0).toLocaleString()} clicks`} color="amber" rate={campaign.click_rate ?? 0} />
        <MetricCard label="Failed" value={(campaign.total_failed ?? 0).toLocaleString()} sub="delivery failures" color="rose" />
        <MetricCard label="Est. Revenue" value={`₹${((campaign.total_clicked ?? 0) * 0.15 * 2500 / 1000).toFixed(1)}k`} sub="from clicks" color="emerald" />
      </div>

      {/* AI Insights Panel */}
      {showInsights && (
        <div className="glass-card rounded-2xl overflow-hidden border border-indigo-500/20">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-indigo-500/5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-slate-200">AI Campaign Insights</span>
              <span className="text-xs text-slate-500">Powered by Groq</span>
            </div>
            <button onClick={() => setShowInsights(false)} className="text-slate-500 hover:text-slate-300">
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          {insightsLoading ? (
            <div className="flex items-center gap-3 px-5 py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Analyzing campaign performance...</span>
            </div>
          ) : insights ? (
            <div className="p-5 space-y-5">
              {/* Score + Highlight */}
              <div className="flex items-start gap-4">
                {insights.performance_score > 0 && (
                  <div className="shrink-0 w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-indigo-400">{insights.performance_score}</span>
                    <span className="text-xs text-slate-500">/10</span>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm text-slate-300 leading-relaxed">{insights.summary}</p>
                  {insights.highlight && (
                    <p className="mt-2 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl">
                      💡 {insights.highlight}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Observations */}
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Observations</h4>
                  <ul className="space-y-2">
                    {(insights.observations || []).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Recommendations */}
                <div className="bg-slate-900/50 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recommendations</h4>
                  <ul className="space-y-2">
                    {(insights.recommendations || []).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Message Template */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Message Template</h2>
        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/50 rounded-xl px-4 py-3 border border-slate-800">
          {campaign.message_template}
        </p>
      </div>

      {/* Live Communications Log */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-200">Communications Log</h2>
            <span className="text-xs text-slate-500">({comms.length} total)</span>
            {(campaign.status === "active" || campaign.status === "launching") && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-800 overflow-x-auto">
          {["all", "pending", "sent", "delivered", "opened", "clicked", "failed"].map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`text-xs px-2.5 py-1.5 rounded-lg capitalize transition-colors whitespace-nowrap ${
                statusFilter === f ? "bg-violet-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}>
              {f}{f !== "all" && statusCounts[f] ? ` (${statusCounts[f]})` : ""}
            </button>
          ))}
        </div>

        {filteredComms.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            {comms.length === 0
              ? "No messages sent yet. Launch the campaign to start."
              : `No communications with status "${statusFilter}".`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Sent At</th>
                  <th className="text-left px-5 py-3 font-medium hidden lg:table-cell">Delivered At</th>
                  <th className="text-left px-5 py-3 font-medium hidden xl:table-cell">Opened At</th>
                </tr>
              </thead>
              <tbody>
                {filteredComms.map((comm) => (
                  <tr key={comm.id} className="border-b border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-200">{comm.customer_name}</p>
                      <p className="text-xs text-slate-500">{comm.customer_email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-1.5 capitalize font-medium ${COMM_STATUS_STYLES[comm.status] || "text-slate-400"}`}>
                        {COMM_STATUS_ICONS[comm.status]}
                        {comm.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs hidden md:table-cell">
                      {comm.sent_at ? new Date(comm.sent_at).toLocaleTimeString("en-IN") : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs hidden lg:table-cell">
                      {comm.delivered_at ? new Date(comm.delivered_at).toLocaleTimeString("en-IN") : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs hidden xl:table-cell">
                      {comm.opened_at ? new Date(comm.opened_at).toLocaleTimeString("en-IN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Users, Megaphone, TrendingUp, IndianRupee, Sparkles, ArrowRight, ChevronRight, Clock, Zap } from "lucide-react";
import StatsCard from "@/components/StatsCard";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Stats {
  total_customers: number;
  average_spend: number;
  cities_breakdown: Record<string, number>;
  active_count: number;
  inactive_count: number;
  recoverable_revenue: number;
}

interface Campaign {
  id: number;
  name: string;
  segment_name: string;
  status: string;
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_failed: number;
  deliver_rate: number;
  open_rate: number;
  channel: string;
  created_at: string;
  launched_at: string | null;
}

interface AISuggestion {
  title: string;
  audience: string;
  reason: string;
  channel: string;
  message_template: string;
  filters: Record<string, unknown>;
  estimated_reach: number;
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

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  useEffect(() => {
    // Fetch stats and campaigns in parallel
    Promise.all([
      fetch(`${API}/api/customers/stats`).then((r) => r.json()),
      fetch(`${API}/api/campaigns`).then((r) => r.json()),
    ])
      .then(([statsData, campaignsData]) => {
        setStats(statsData);
        setCampaigns(campaignsData);
      })
      .catch(console.error)
      .finally(() => setLoadingStats(false));

    // Fetch AI suggestions separately (may be slow)
    fetch(`${API}/api/ai/suggest`, { method: "POST" })
      .then((r) => r.json())
      .then(setSuggestions)
      .catch(console.error)
      .finally(() => setLoadingSuggestions(false));
  }, []);

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const avgOpenRate = campaigns.length > 0
    ? campaigns.filter((c) => (c.open_rate ?? 0) > 0).reduce((acc, c) => acc + (c.open_rate ?? 0), 0) /
      Math.max(campaigns.filter((c) => (c.open_rate ?? 0) > 0).length, 1)
    : 0;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">
            Welcome back 👋
          </h1>
          <p className="text-slate-400 mt-1">
            Here's what's happening with your customers today.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
          <Clock className="w-3.5 h-3.5" />
          <span>{new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      {loadingStats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-36 rounded-2xl shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatsCard
            title="Total Customers"
            value={stats?.total_customers.toLocaleString("en-IN") ?? "—"}
            icon={Users}
            description="All registered shoppers"
            color="indigo"
            trend={{ value: 5.4, isPositive: true }}
            tooltip="Total number of customers in the CRM"
          />
          <StatsCard
            title="Total Revenue"
            value={`₹${((stats?.average_spend || 0) * (stats?.total_customers || 0) / 1000000).toFixed(1)}M`}
            icon={IndianRupee}
            description="Lifetime value"
            color="emerald"
            trend={{ value: 12.5, isPositive: true }}
            tooltip="Estimated lifetime revenue across all customers"
          />
          <StatsCard
            title="Active Customers"
            value={stats?.active_count.toLocaleString("en-IN") ?? "—"}
            icon={Users}
            description="Purchased in last 60 days"
            color="violet"
            trend={{ value: 8.2, isPositive: true }}
            tooltip="Customers who made a purchase within the last 60 days"
          />
          <StatsCard
            title="Customers At Risk"
            value={stats?.inactive_count.toLocaleString("en-IN") ?? "—"}
            icon={Clock}
            description={stats?.recoverable_revenue ? `Recoverable: ₹${(stats.recoverable_revenue / 1000000).toFixed(1)}M` : "Inactive > 60 days"}
            color="rose"
            trend={{ value: 4.1, isPositive: false }}
            tooltip="Customers inactive for more than 60 days"
          />
          <StatsCard
            title="Campaign Success Rate"
            value={`${avgOpenRate.toFixed(1)}%`}
            icon={TrendingUp}
            description="Average open rate"
            color="amber"
            trend={{ value: 2.4, isPositive: true }}
            tooltip="Average open rate across completed campaigns"
          />
        </div>
      )}

      {/* AI Suggestions */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/20">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-200">AI Campaign Suggestions</h2>
          </div>
          <span className="text-xs text-slate-500">Powered by Groq AI</span>
        </div>

        {loadingSuggestions ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-48 rounded-2xl shimmer" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.map((sug, idx) => (
              <Link
                key={idx}
                href={`/campaigns?suggest=${encodeURIComponent(JSON.stringify(sug))}`}
                className="group glass-card rounded-2xl p-5 cursor-pointer hover:border-violet-500/30 hover:bg-slate-800/60 transition-all duration-300 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CHANNEL_ICONS[sug.channel] || "📢"}</span>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{sug.channel}</span>
                  </div>
                  <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full font-medium">
                    ~{sug.estimated_reach} customers
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-200 group-hover:text-violet-300 transition-colors text-sm leading-snug">
                    {sug.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{sug.reason}</p>
                </div>
                <div className="mt-auto flex items-center gap-1 text-xs text-violet-400 font-medium">
                  <Zap className="w-3 h-3" />
                  <span>Use this suggestion</span>
                  <ChevronRight className="w-3 h-3 ml-auto group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
            {suggestions.length === 0 && (
              <div className="col-span-3 text-center text-slate-500 py-12 glass-card rounded-2xl">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No AI suggestions available. Check back after you have campaigns running.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent Campaigns */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Recent Campaigns</h2>
          <Link
            href="/campaigns"
            className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="glass-card rounded-2xl overflow-hidden">
          {campaigns.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-400">No campaigns yet</p>
              <p className="text-sm mt-1">Create your first campaign to get started.</p>
              <Link href="/campaigns" className="mt-4 inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-xl transition-colors">
                Create Campaign
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left px-5 py-3 font-medium">Campaign</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">Segment</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium hidden lg:table-cell">Sent</th>
                  <th className="text-right px-5 py-3 font-medium hidden lg:table-cell">Open Rate</th>
                  <th className="text-right px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 8).map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span>{CHANNEL_ICONS[c.channel] || "📢"}</span>
                        <span className="font-medium text-slate-200">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 hidden md:table-cell">{c.segment_name}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS[c.status] || "bg-slate-700 text-slate-300"}`}>
                        {c.status === 'active' ? 'running' : c.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400 hidden lg:table-cell">{c.total_sent.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right hidden lg:table-cell">
                      {(c.open_rate ?? 0) > 0 ? (
                        <span className="text-emerald-400 font-medium">{(c.open_rate ?? 0).toFixed(1)}%</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1 justify-end"
                      >
                        View <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Users, Layers, Sparkles, Filter, X, Loader2, Bot } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Segment {
  id: number;
  name: string;
  description: string;
  filters: Record<string, unknown>;
  filter_tags: string[];
  customer_count: number;
  created_at: string;
}

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"];
const CATEGORIES = ["Apparel", "Footwear", "Accessories", "Beauty", "Electronics"];

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"rules" | "ai">("rules");

  // Search and Sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "count">("date");

  // Rule builder state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [maxSpend, setMaxSpend] = useState("");
  const [inactiveDays, setInactiveDays] = useState("");
  const [minOrders, setMinOrders] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [vip, setVip] = useState(false);
  const [newCustomers, setNewCustomers] = useState(false);

  // AI builder state
  const [aiDescription, setAiDescription] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ filters: Record<string, unknown>; filter_tags: string[]; customer_count: number; explanation: string } | null>(null);

  // Preview state
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSegments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/segments`);
      setSegments(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSegments(); }, []);

  const getRuleFilters = useCallback(() => {
    const f: Record<string, unknown> = {};
    if (vip) f.vip = true;
    if (newCustomers) f.new_customers = true;
    if (minSpend) f.min_spend = parseFloat(minSpend);
    if (maxSpend) f.max_spend = parseFloat(maxSpend);
    if (inactiveDays) f.inactive_days = parseInt(inactiveDays);
    if (minOrders) f.min_orders = parseInt(minOrders);
    if (city) f.city = city;
    if (category) f.category = category;
    return f;
  }, [vip, newCustomers, minSpend, maxSpend, inactiveDays, minOrders, city, category]);

  // Live preview
  useEffect(() => {
    if (activeTab !== "rules" || !showModal) return;
    const f = getRuleFilters();
    if (Object.keys(f).length === 0) { setPreviewCount(null); return; }
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/api/segments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "_preview", description: "", filters: f }),
        });
        const data = await res.json();
        setPreviewCount(data.customer_count);
      } catch { setPreviewCount(null); }
      finally { setPreviewLoading(false); }
    }, 700);
    return () => clearTimeout(t);
  }, [vip, newCustomers, minSpend, maxSpend, inactiveDays, minOrders, city, category, activeTab, showModal, getRuleFilters]);

  const handleAITranslate = async () => {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`${API}/api/ai/segment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription }),
      });
      setAiResult(await res.json());
    } catch (e) { console.error(e); }
    finally { setAiLoading(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) return alert("Segment name is required.");
    setSaving(true);
    const filters = activeTab === "ai" && aiResult ? aiResult.filters : getRuleFilters();
    try {
      const res = await fetch(`${API}/api/segments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, filters }),
      });
      if (!res.ok) throw new Error("Save failed");
      await fetchSegments();
      resetModal();
    } catch { alert("Failed to save segment."); }
    finally { setSaving(false); }
  };

  const resetModal = () => {
    setShowModal(false);
    setName(""); setDescription(""); setMinSpend(""); setMaxSpend("");
    setInactiveDays(""); setMinOrders(""); setCity(""); setCategory("");
    setVip(false); setNewCustomers(false);
    setAiDescription(""); setAiResult(null); setPreviewCount(null);
    setActiveTab("rules");
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Segments</h1>
          <p className="text-slate-400 mt-1">{segments.length} saved customer segments</p>
        </div>
        <button
          id="create-segment-btn"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all text-sm hover:shadow-lg hover:shadow-violet-500/25"
        >
          <Plus className="w-4 h-4" /> Create Segment
        </button>
      </div>

      {/* Controls: Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <input
          type="text"
          placeholder="Search segments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
        />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "name" | "count")}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
          >
            <option value="date">Newest First</option>
            <option value="name">Name (A-Z)</option>
            <option value="count">Customer Count</option>
          </select>
        </div>
      </div>

      {/* Segments Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-44 shimmer rounded-2xl" />)}
        </div>
      ) : segments.length === 0 ? (
        <div className="glass-card rounded-2xl py-20 text-center text-slate-500">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-slate-400 text-lg">No segments yet</p>
          <p className="text-sm mt-1 mb-6">Create your first customer segment.</p>
          <button onClick={() => setShowModal(true)} className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-5 py-2.5 rounded-xl font-medium transition-colors">
            Create Segment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments
            .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase())))
            .sort((a, b) => {
              if (sortBy === "name") return a.name.localeCompare(b.name);
              if (sortBy === "count") return b.customer_count - a.customer_count;
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            })
            .map((seg) => (
            <div key={seg.id} className="glass-card rounded-2xl p-5 hover:border-violet-500/30 transition-all group flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Layers className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800 rounded-xl px-3 py-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-200">{seg.customer_count.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-200 group-hover:text-violet-300 transition-colors">{seg.name}</h3>
                {seg.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{seg.description}</p>}
              </div>
              {/* Human-readable filter tags */}
              <div className="flex flex-wrap gap-1.5">
                {(seg.filter_tags || ["All customers"]).map((tag, i) => (
                  <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="text-xs text-slate-600 mt-auto">
                Created {new Date(seg.created_at).toLocaleDateString("en-IN")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Segment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetModal} />
          <div className="relative glass-card rounded-2xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-200">Create New Segment</h2>
              <button onClick={resetModal} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Name + Desc */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Segment Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mumbai VIP Customers"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Description (optional)</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors" />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 bg-slate-900 rounded-xl p-1">
                {([["rules", "Rule Builder", Filter], ["ai", "AI Builder", Sparkles]] as const).map(([tab, label, Icon]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20" : "text-slate-400 hover:text-slate-200"
                    }`}>
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              {/* Rule Builder */}
              {activeTab === "rules" && (
                <div className="space-y-4">
                  {/* Business rule toggles */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "VIP Customers", desc: "Top 10% spenders", key: "vip", val: vip, set: setVip },
                      { label: "New Customers", desc: "Purchased last 30 days", key: "new", val: newCustomers, set: setNewCustomers },
                    ].map((t) => (
                      <button key={t.key} onClick={() => t.set(!t.val)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          t.val ? "bg-violet-500/10 border-violet-500/40 text-violet-300" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}>
                        <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center shrink-0 ${t.val ? "bg-violet-600 border-violet-600" : "border-slate-600"}`}>
                          {t.val && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div>
                          <p className="text-xs font-medium">{t.label}</p>
                          <p className="text-xs opacity-60 mt-0.5">{t.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Min Spend (₹)", val: minSpend, set: setMinSpend, ph: "e.g. 2000" },
                      { label: "Max Spend (₹)", val: maxSpend, set: setMaxSpend, ph: "e.g. 10000" },
                      { label: "Inactive for (days)", val: inactiveDays, set: setInactiveDays, ph: "e.g. 60" },
                      { label: "Min Orders", val: minOrders, set: setMinOrders, ph: "e.g. 3" },
                    ].map((f) => (
                      <div key={f.label}>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">{f.label}</label>
                        <input type="number" value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors" />
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">City</label>
                      <select value={city} onChange={(e) => setCity(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer">
                        <option value="">Any City</option>
                        {CITIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
                      <select value={category} onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer">
                        <option value="">Any Category</option>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    {previewLoading ? (
                      <><Loader2 className="w-4 h-4 text-violet-400 animate-spin" /><span className="text-sm text-slate-400">Calculating...</span></>
                    ) : previewCount !== null ? (
                      <><Users className="w-4 h-4 text-emerald-400" /><span className="text-sm text-slate-300"><span className="font-bold text-emerald-400">{previewCount.toLocaleString("en-IN")}</span> customers match</span></>
                    ) : (
                      <><Filter className="w-4 h-4 text-slate-500" /><span className="text-sm text-slate-500">Set filters to preview audience size</span></>
                    )}
                  </div>
                </div>
              )}

              {/* AI Builder */}
              {activeTab === "ai" && (
                <div className="space-y-4">
                  <textarea value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} rows={3}
                    placeholder="e.g. customers from Bangalore who love beauty products and haven't ordered in 45 days..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors resize-none" />
                  <button onClick={handleAITranslate} disabled={!aiDescription.trim() || aiLoading}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-xl transition-colors font-medium">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    {aiLoading ? "Translating..." : "Translate with AI"}
                  </button>
                  {aiResult && (
                    <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-sm font-medium">AI Analysis</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-sm font-bold text-emerald-400">{aiResult.customer_count.toLocaleString("en-IN")}</span>
                          <span className="text-xs text-slate-500">customers</span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300">{aiResult.explanation}</p>
                      <div className="flex flex-wrap gap-2">
                        {(aiResult.filter_tags || []).map((tag, i) => (
                          <span key={i} className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/50">
              <button onClick={resetModal} className="text-slate-400 hover:text-slate-200 px-4 py-2.5 rounded-xl transition-colors text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || !name.trim() || (activeTab === "ai" && !aiResult)}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl transition-colors font-medium text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save Segment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

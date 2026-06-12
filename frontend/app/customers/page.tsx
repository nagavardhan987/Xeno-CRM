"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Filter, Users, MapPin, IndianRupee, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  total_spend: number;
  order_count: number;
  last_purchase_date: string | null;
  preferred_category: string;
  is_active: boolean;
}

const CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"];
const CATEGORIES = ["Apparel", "Footwear", "Accessories", "Beauty", "Electronics"];

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function purchaseBadge(dateStr: string | null) {
  const days = daysSince(dateStr);
  if (days === null) return <span className="text-slate-500 text-xs">Unknown</span>;
  if (days <= 30) return (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
      {days}d ago
    </span>
  );
  if (days <= 60) return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      {days}d ago
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-rose-400">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
      {days}d ago
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(page * LIMIT),
    });
    if (search) params.set("search", search);
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (status) params.set("status", status);

    try {
      const res = await fetch(`${API}/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, city, category, status, page]);

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Customers</h1>
          <p className="text-slate-400 mt-1">
            {total.toLocaleString("en-IN")} customers in your database
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Active ≤30d
          </span>
          <span className="flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            30–60d
          </span>
          <span className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Inactive 60d+
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* City filter */}
        <select
          value={city}
          onChange={(e) => { setCity(e.target.value); setPage(0); }}
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
        >
          <option value="">All Cities</option>
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        {/* Category filter */}
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(0); }}
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="active">Active (≤60d)</option>
          <option value="inactive">Inactive (60d+)</option>
        </select>

        {(search || city || category || status) && (
          <button
            onClick={() => { setSearch(""); setCity(""); setCategory(""); setStatus(""); setPage(0); }}
            className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-3 py-2 rounded-xl border border-rose-500/20 hover:bg-rose-500/10"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="space-y-px">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 shimmer" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-slate-400">No customers found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Customer</th>
                  <th className="text-left px-5 py-3 font-medium hidden md:table-cell">
                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> City</div>
                  </th>
                  <th className="text-right px-5 py-3 font-medium">
                    <div className="flex items-center gap-1 justify-end"><IndianRupee className="w-3 h-3" /> Spend</div>
                  </th>
                  <th className="text-right px-5 py-3 font-medium hidden lg:table-cell">
                    <div className="flex items-center gap-1 justify-end"><ShoppingBag className="w-3 h-3" /> Orders</div>
                  </th>
                  <th className="text-left px-5 py-3 font-medium hidden xl:table-cell">Category</th>
                  <th className="text-left px-5 py-3 font-medium">Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-slate-200 group-hover:text-violet-300 transition-colors">{c.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{c.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-400 hidden md:table-cell">{c.city}</td>
                    <td className="px-5 py-4 text-right font-medium text-slate-200">
                      ₹{c.total_spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400 hidden lg:table-cell">{c.order_count}</td>
                    <td className="px-5 py-4 hidden xl:table-cell">
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-lg">{c.preferred_category}</span>
                    </td>
                    <td className="px-5 py-4">
                      {purchaseBadge(c.last_purchase_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800 text-sm text-slate-400">
              <span>
                Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of {total.toLocaleString()} customers
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

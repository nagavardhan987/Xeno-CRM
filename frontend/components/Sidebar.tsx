"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  LayoutDashboard,
  Users,
  Layers,
  Megaphone,
  Bot,
  Sparkles,
  ChevronRight,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/copilot", label: "AI Copilot", icon: Bot, highlight: true },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/segments", label: "Segments", icon: Layers },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  if (pathname === "/login" || pathname === "/signup") return null;

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-slate-950 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-100 leading-none">Xeno CRM</p>
            <p className="text-xs text-violet-400 mt-0.5">AI Copilot</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, highlight }, idx) => {
          const isActive =
            pathname === href || (href !== "/" && pathname.startsWith(href));

          if (idx === 1) {
            // Add separator before Dashboard
            return (
              <div key={href}>
                <p className="text-xs font-medium text-slate-700 uppercase tracking-wider px-3 mt-3 mb-2">
                  Navigation
                </p>
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? "bg-violet-600/20 text-violet-300 border border-violet-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-violet-400" : "group-hover:text-slate-300"}`} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-violet-400" />}
                </Link>
              </div>
            );
          }

          // AI Copilot — special highlighted button
          if (highlight) {
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group mb-1 ${
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30"
                    : "bg-gradient-to-r from-violet-600/15 to-indigo-600/10 text-violet-300 border border-violet-500/25 hover:from-violet-600/25 hover:to-indigo-600/20"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="flex-1">{label}</span>
                <Sparkles className="w-3 h-3 opacity-70" />
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-violet-600/20 text-violet-300 border border-violet-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-violet-400" : "group-hover:text-slate-300"}`} />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-violet-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        {user && (
          <div className="flex items-center justify-between px-2 pt-2 pb-2">
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-slate-200 truncate">{user.user_metadata?.full_name || 'Authenticated User'}</span>
              <span className="text-xs text-slate-500 truncate">{user.email}</span>
            </div>
            <button 
              onClick={signOut}
              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-violet-500/20">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Groq AI</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

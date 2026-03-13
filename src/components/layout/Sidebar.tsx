"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
  LayoutDashboard,
  Bookmark,
  Upload,
  Building2,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "All Bids",
    href: "/bids",
    icon: LayoutDashboard,
  },
];

const myBidsItems = [
  { label: "Ongoing", href: "/my-bids/ongoing", icon: Clock },
  { label: "Exploring", href: "/my-bids/exploring", icon: Search },
];

export function Sidebar() {
  const pathname = usePathname();
  const [myBidsOpen, setMyBidsOpen] = useState(
    pathname.startsWith("/my-bids")
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden bg-slate-900 text-white p-2 rounded-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/50">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <FileText size={18} />
          </div>
          <span className="font-semibold text-lg">TenderBid</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}

          {/* My Bids (collapsible) */}
          <div>
            <button
              onClick={() => setMyBidsOpen(!myBidsOpen)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/my-bids")
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Bookmark size={18} />
              <span className="flex-1 text-left">My Bids</span>
              {myBidsOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>

            {myBidsOpen && (
              <div className="ml-4 mt-1 space-y-1">
                {myBidsItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-indigo-500/10 text-indigo-300"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      )}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Company Vault */}
          <Link
            href="/vault"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith("/vault")
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Building2 size={18} />
            Company Vault
          </Link>

          {/* Upload Tender */}
          <Link
            href="/upload"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith("/upload")
                ? "bg-indigo-500/20 text-indigo-300"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Upload size={18} />
            Upload Tender
          </Link>
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/50">
          <p className="text-xs text-slate-500">Tender Discovery Platform</p>
        </div>
      </aside>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/nominations", label: "Nominations", icon: "🎯" },
  { href: "/history", label: "History", icon: "📜" },
  { href: "/members", label: "Members", icon: "👥" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 h-screen w-56 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="p-5 border-b border-[var(--color-border)]">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <span className="text-2xl">🎮</span>
          <span>Game Club</span>
        </Link>
      </div>
      <div className="flex-1 p-3 flex flex-col gap-1">
        {links.map((link) => {
          const isActive =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="p-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
        Game Club v0.1.0
      </div>
    </nav>
  );
}

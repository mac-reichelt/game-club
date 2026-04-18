"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/nominations", label: "Nominations", icon: "🎯" },
  { href: "/elections", label: "Elections", icon: "🗳️" },
];

interface NavbarUser {
  id: number;
  name: string;
  avatar: string;
}

export default function Navbar({ user }: { user: NavbarUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed top-0 left-0 h-screen w-56 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] z-40">
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
        <div className="p-4 border-t border-[var(--color-border)]">
          <Link
            href="/profile"
            className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity"
          >
            <span className="text-xl">{user.avatar}</span>
            <span className="text-sm font-medium truncate">{user.name}</span>
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors text-left"
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </nav>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] z-40 safe-area-bottom">
        <div className="flex items-center justify-around px-1 py-1">
          {links.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors min-w-0 flex-1 ${
                  isActive
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                <span className="text-lg leading-none">{link.icon}</span>
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}
          <Link
            href="/profile"
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors min-w-0 flex-1 ${
              pathname === "/profile"
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            <span className="text-lg leading-none">{user.avatar}</span>
            <span className="truncate">{user.name}</span>
          </Link>
        </div>
      </nav>
    </>
  );
}

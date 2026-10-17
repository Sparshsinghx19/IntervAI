'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, FileText, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/AuthProvider";

const SECTION_LINKS = [
  { href: "#session", label: "How it works" },
  { href: "#coding", label: "Coding" },
  { href: "#feedback", label: "Feedback" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-glow">
        <span className="text-white font-bold text-lg leading-none tracking-tighter">IV</span>
      </div>
      <span className="text-xl font-bold text-white tracking-tight">IntervAI</span>
    </Link>
  );
}

/** Marketing nav: transparent over the hero, solid once the page scrolls. Only re-renders when crossing the threshold. */
function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const isAuthenticated = useAuth().status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50 border-b transition-[background-color,border-color] duration-300",
        scrolled ? "border-white/[0.06] bg-obsidian/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Logo />

        <div className="hidden md:flex items-center gap-1 text-sm text-slate-400">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated ? (
            <>
              <MyReportsLink className="hidden sm:inline-flex" />
              <LogoutButton className="hidden sm:inline-flex" />
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-full px-3.5 sm:h-9 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              Log in
            </Link>
          )}
          <Link
            href={isAuthenticated ? "/interview" : "/signup"}
            className="inline-flex h-10 items-center rounded-full bg-white px-4 sm:h-9 text-sm font-medium text-obsidian transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
          >
            {isAuthenticated ? "Start practising" : "Get started"}
          </Link>
        </div>
      </div>
    </nav>
  );
}

/** Link to the signed-in user's saved interview reports. */
function MyReportsLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = pathname === "/reports";
  return (
    <Link
      href="/reports"
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-medium transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:px-3.5",
        active ? "text-white" : "text-slate-300",
        className,
      )}
    >
      <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">My Reports</span>
    </Link>
  );
}

/** Signs out, then returns to the landing page. Local drafts and layout preferences are left untouched. */
function LogoutButton({ className }: { className?: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    setPending(true);
    await logout();
    router.push("/");
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-60 sm:px-3.5",
        className,
      )}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{pending ? "Logging out…" : "Log out"}</span>
    </button>
  );
}

export function Navbar({ mode = 'marketing' }: { mode?: 'marketing' | 'app' | 'session' }) {
  if (mode === 'marketing') return <MarketingNav />;

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-obsidian/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Logo />

          {mode === 'app' && (
            <div className="flex items-center gap-2 sm:gap-4">
              <AccountSummary />
              <Link href="/" className="group flex items-center whitespace-nowrap text-sm font-medium text-slate-400 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
                Back to Home
              </Link>
            </div>
          )}

          {mode === 'session' && (
            <div className="flex items-center">
              {/* No right-side links in session mode */}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function AccountSummary() {
  const { status, user } = useAuth();
  if (status !== "authenticated" || !user) return null;
  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-[160px] truncate text-sm text-slate-400 md:inline" title={user.email}>
        {user.name}
      </span>
      <MyReportsLink />
      <LogoutButton />
    </div>
  );
}

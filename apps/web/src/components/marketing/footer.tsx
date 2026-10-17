import Link from "next/link";

const LINKS = [
  { href: "/interview", label: "Start practising" },
  { href: "#session", label: "How it works" },
  { href: "#coding", label: "Coding workspace" },
  { href: "#feedback", label: "Feedback" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-obsidian">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-cyan-500">
              <span className="text-xs font-bold text-white">IV</span>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">IntervAI</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">Interview practice with scored feedback.</p>
        </div>

        <nav aria-label="Footer" className="-my-2 flex flex-wrap gap-x-6 text-sm text-slate-400">
          {LINKS.map((link) =>
            link.href.startsWith("/") ? (
              <Link key={link.href} href={link.href} className="py-2.5 transition-colors hover:text-white">
                {link.label}
              </Link>
            ) : (
              <a key={link.href} href={link.href} className="py-2.5 transition-colors hover:text-white">
                {link.label}
              </a>
            ),
          )}
        </nav>

        <p className="text-sm text-slate-600">© {new Date().getFullYear()} IntervAI</p>
      </div>
    </footer>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-obsidian py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-brand-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">IV</span>
          </div>
          <span className="text-lg font-bold text-white tracking-tight">IntervAI</span>
        </div>
        
        <div className="flex gap-6 text-sm text-slate-400">
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <a href="#" className="hover:text-white transition-colors">Contact</a>
        </div>
        
        <div className="text-sm text-slate-500">
          © {new Date().getFullYear()} IntervAI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

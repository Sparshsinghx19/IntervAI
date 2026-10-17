import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { SessionFlow } from "@/components/marketing/session-flow";
import { CodingShowcase } from "@/components/marketing/coding-showcase";
import { ReportShowcase } from "@/components/marketing/report-showcase";
import { FinalCta, WhySection } from "@/components/marketing/closing";
import { Footer } from "@/components/marketing/footer";
import { MotionRoot } from "@/components/marketing/primitives";

export default function LandingPage() {
  return (
    <MotionRoot>
      <div className="min-h-screen bg-obsidian font-[family-name:var(--font-geist-sans)] text-foreground selection:bg-brand-500/30">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:text-obsidian"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">
          <Hero />
          <SessionFlow />
          <CodingShowcase />
          <ReportShowcase />
          <WhySection />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </MotionRoot>
  );
}

import { useNavigate } from "react-router-dom";
import { FileText, MessageSquare, Search, Shield, ArrowRight, Brain, Upload, Lightbulb, Scale, Users, BarChart3, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef } from "react";

const features = [
  {
    icon: MessageSquare,
    title: "Ask anything about your documents",
    description: "Type a question in plain English. Get a precise answer with the exact page and paragraph it came from.",
  },
  {
    icon: Search,
    title: "Find what matters, fast",
    description: "Our retrieval engine searches across all your uploaded files simultaneously — no more Ctrl+F through 200 pages.",
  },
  {
    icon: FileText,
    title: "Extract structured data automatically",
    description: "Pull out dates, names, obligations, and key terms into clean tables. Works on contracts, CVs, reports, and more.",
  },
  {
    icon: Shield,
    title: "Every answer is cited",
    description: "No black-box responses. Every answer links back to the source text so you can verify it yourself.",
  },
  {
    icon: Lightbulb,
    title: "Spot risks and missing clauses",
    description: "Run an analysis to surface unclear language, missing sections, or potential issues — before they become problems.",
  },
];

const steps = [
  { number: "01", title: "Upload your documents", description: "Drag and drop any PDF. We process it in seconds." },
  { number: "02", title: "Ask your question", description: "Type what you need to know — in your own words." },
  { number: "03", title: "Get cited answers", description: "Receive precise answers with page references you can click to verify." },
];

const useCases = [
  {
    icon: Scale,
    title: "Legal teams",
    description: "Review contracts faster. Find specific clauses, compare terms across agreements, and flag risks before signing.",
  },
  {
    icon: Users,
    title: "Recruiters",
    description: "Screen resumes at scale. Extract skills, experience, and qualifications into structured summaries in seconds.",
  },
  {
    icon: BarChart3,
    title: "Analysts",
    description: "Dig into reports, filings, and research papers. Cross-reference data points across multiple documents.",
  },
];

function useIntersectionAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in-up");
            entry.target.classList.remove("opacity-0");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    const children = el.querySelectorAll("[data-animate]");
    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);
  return ref;
}

const LandingPage = () => {
  const navigate = useNavigate();
  const featuresRef = useIntersectionAnimation();
  const stepsRef = useIntersectionAnimation();
  const useCasesRef = useIntersectionAnimation();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-base font-semibold text-foreground tracking-tight">DocMind AI</span>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#use-cases" className="hover:text-foreground transition-colors">Use cases</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
              Log in
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Try it free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-28 pb-24 px-6 overflow-hidden" style={{ background: "var(--hero-gradient)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(ellipse 60% 50% at 50% 0%, hsl(174 62% 47% / 0.08) 0%, transparent 70%)"
        }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <p className="inline-block text-xs font-medium tracking-widest uppercase text-primary/80 mb-6 animate-fade-in-up">
            Document intelligence for teams
          </p>
          <h1
            className="text-4xl sm:text-5xl md:text-[3.5rem] font-bold leading-[1.1] tracking-tight mb-5 animate-fade-in-up"
            style={{ color: "hsl(0 0% 96%)", animationDelay: "0.08s" }}
          >
            Stop reading documents.
            <br />
            <span className="text-primary">Start understanding them.</span>
          </h1>
          <p
            className="text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed animate-fade-in-up"
            style={{ color: "hsl(220 10% 65%)", animationDelay: "0.16s" }}
          >
            Upload any PDF — contracts, reports, resumes — and ask questions in plain English.
            Get precise, cited answers in seconds instead of hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in-up" style={{ animationDelay: "0.24s" }}>
            <Button size="lg" className="text-sm px-7 py-5 shadow-md shadow-primary/20" onClick={() => navigate("/auth")}>
              Try it free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-sm px-7 py-5 border-border/50 bg-transparent hover:bg-card/10" style={{ color: "hsl(220 10% 70%)" }} onClick={() => {
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}>
              See how it works
            </Button>
          </div>
        </div>

        {/* Subtle trust line */}
        <div className="relative max-w-2xl mx-auto mt-16 text-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <p className="text-xs tracking-wide" style={{ color: "hsl(220 10% 40%)" }}>
            Trusted by legal, HR, and research teams processing thousands of documents
          </p>
          <div className="flex items-center justify-center gap-8 mt-4 opacity-30">
            {["Acme Corp", "Lexis", "TalentHQ", "DataVault", "BrightLaw"].map((name) => (
              <span key={name} className="text-xs font-semibold tracking-wider uppercase" style={{ color: "hsl(220 10% 50%)" }}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6" ref={featuresRef}>
        <div className="max-w-5xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Built for how you actually work with documents
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Not another chatbot. A focused toolkit that saves you hours of manual review.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                data-animate
                className="opacity-0 group p-5 rounded-xl border border-border/60 bg-card hover:border-primary/20 hover:shadow-sm transition-all duration-300"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3.5 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-card-foreground mb-1.5">{f.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-muted/30" ref={stepsRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Three steps. That's it.
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              No setup, no training data, no complicated configuration.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.number} data-animate className="opacity-0 text-center" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="text-4xl font-bold text-primary/20 mb-3">{step.number}</div>
                <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="py-24 px-6" ref={useCasesRef}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
              Works for the people who need it most
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Built for professionals who spend hours reading documents every week.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {useCases.map((uc, i) => (
              <div key={uc.title} data-animate className="opacity-0 p-6 rounded-xl border border-border/60 bg-card" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <uc.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-card-foreground mb-2">{uc.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6" style={{ background: "var(--hero-gradient)" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: "hsl(0 0% 96%)" }}>
            Ready to save hours on document review?
          </h2>
          <p className="text-sm sm:text-base mb-8" style={{ color: "hsl(220 10% 60%)" }}>
            Upload your first document and see the difference in under a minute.
          </p>
          <Button size="lg" className="text-sm px-8 py-5" onClick={() => navigate("/auth")}>
            Get started free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="h-4.5 w-4.5 text-primary" />
            <span className="text-sm font-semibold text-foreground">DocMind AI</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} DocMind AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

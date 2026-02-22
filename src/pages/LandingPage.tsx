import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Scale,
  ShieldCheck,
  Star,
  Wallet,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const HERO_VIDEO_SRC =
  "https://videos.pexels.com/video-files/5152196/5152196-hd_1920_1080_25fps.mp4";
const HERO_POSTER_URL =
  "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=2200&q=85";
const SOLUTION_MONTAGE_VIDEO_SRC =
  "https://videos.pexels.com/video-files/3209298/3209298-hd_1920_1080_25fps.mp4";
const SOLUTION_MONTAGE_POSTER_URL =
  "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=2200&q=85";
const VISION_VIDEO_SRC =
  "https://videos.pexels.com/video-files/3184428/3184428-hd_1920_1080_24fps.mp4";
const VISION_POSTER_URL =
  "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=2200&q=85";

const pageMotion = `
  @keyframes aboutFadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes aboutPulse {
    0% { transform: scale(0.95); opacity: 0.4; }
    50% { transform: scale(1); opacity: 0.9; }
    100% { transform: scale(0.95); opacity: 0.4; }
  }

  @keyframes aboutMockupFloat {
    0% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
    100% { transform: translateY(0); }
  }

  @keyframes aboutLineFlow {
    0% { transform: translateX(-8%); opacity: 0.45; }
    50% { transform: translateX(8%); opacity: 0.8; }
    100% { transform: translateX(-8%); opacity: 0.45; }
  }
`;

const useReveal = (threshold = 0.18) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold },
    );
    observer.observe(node);

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
};

const Reveal = ({ children, className = "", delayMs = 0 }: { children: ReactNode; className?: string; delayMs?: number }) => {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 700ms ease, transform 700ms ease`,
        transitionDelay: `${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
};

const CounterCard = ({
  value,
  prefix = "",
  suffix = "",
  label,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
}) => {
  const { ref, visible } = useReveal(0.35);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const duration = 1200;
    const start = performance.now();

    let frame = 0;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const next = Math.round(progress * value);
      setDisplay(next);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, visible]);

  return (
    <div
      ref={ref}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(18px)",
      }}
    >
      <p className="text-4xl font-semibold tracking-tight text-slate-900">
        {prefix}
        {display}
        {suffix}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{label}</p>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrollY, setScrollY] = useState(0);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const solutionVideoRef = useRef<HTMLVideoElement | null>(null);
  const visionVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (heroVideoRef.current) {
      heroVideoRef.current.playbackRate = 0.78;
    }
    if (solutionVideoRef.current) {
      solutionVideoRef.current.playbackRate = 1;
    }
    if (visionVideoRef.current) {
      visionVideoRef.current.playbackRate = 0.85;
    }
  }, []);

  const heroOffset = useMemo(() => Math.min(scrollY * 0.08, 42), [scrollY]);
  const visionOffset = useMemo(() => Math.min(scrollY * 0.05, 26), [scrollY]);

  return (
    <div className="bg-[#f6f8fb] text-slate-900">
      <style>{pageMotion}</style>

      <main>
        <section className="relative min-h-[88vh] overflow-hidden">
          <div className="absolute inset-0">
            <video
              ref={heroVideoRef}
              className="hidden h-full w-full object-cover md:block"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={HERO_POSTER_URL}
            >
              <source src={HERO_VIDEO_SRC} type="video/mp4" />
            </video>
            <img
              src={HERO_POSTER_URL}
              alt="Lausanne campus scene"
              className="h-full w-full object-cover md:hidden"
              loading="eager"
            />
            <div className="absolute inset-0 bg-slate-900/50" />
          </div>

          <div
            className="relative mx-auto flex min-h-[88vh] w-full max-w-6xl items-center px-6 py-20 sm:px-8"
            style={{ transform: `translateY(${heroOffset}px)` }}
          >
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-200">
                Lausanne · Switzerland
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Reinventing Student Housing
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-200 sm:text-xl">
                Built by students. Designed for universities. Made for real life.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-white px-7 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  onClick={() => {
                    window.location.href = "mailto:partnerships@couch-share.com?subject=University%20Partnership";
                  }}
                >
                  Partner With Us
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-slate-200/70 bg-transparent px-7 text-sm font-semibold text-white hover:bg-white/10"
                  onClick={() => navigate(user ? "/listings" : "/auth")}
                >
                  Join the Network <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f7f9fc] py-20 sm:py-24">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 sm:px-8 lg:grid-cols-[1.15fr_1fr]">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">The Problem</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                A Structural Housing Crisis
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-700">
                <p>Universities continue to attract and admit talented students while housing remains structurally limited.</p>
                <p>International students are affected first, often arriving without local networks or immediate housing options.</p>
                <p>New construction helps, but development cycles take years. Housing pressure is immediate and repeated every intake season.</p>
                <p>When housing uncertainty becomes chronic, academic outcomes and retention are directly impacted.</p>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              <CounterCard value={41} suffix="%" label="Students in high-demand intake periods face housing pressure." />
              <CounterCard value={6} suffix="w" label="Typical search period for newly arrived students before stable placement." />
              <CounterCard value={3} prefix="+" suffix=" years" label="Time needed for most housing projects to go live." />
              <CounterCard value={24} suffix="/7" label="Support expectation students have when placement issues appear." />
            </div>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
            <Reveal className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">The Solution</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Unlocking Existing Housing Supply
              </h2>
              <p className="mt-6 text-base leading-relaxed text-slate-700">
                We activate unused housing capacity by helping verified students share couches and spare rooms inside their university ecosystem. The model is flexible, secure by design, and asset-light, making it faster to deploy than traditional housing expansion.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: GraduationCap,
                  title: "Student Exclusive",
                  copy: "Each university has its own closed ecosystem, visible only to verified students from that institution.",
                },
                {
                  icon: ShieldCheck,
                  title: "Verified & Secure",
                  copy: "Access control and structured accountability designed for trusted exchanges.",
                },
                {
                  icon: Wallet,
                  title: "Affordable & Flexible",
                  copy: "Pricing and stay flexibility aligned with real student budgets and academic timelines.",
                },
              ].map((item, index) => (
                <Reveal
                  key={item.title}
                  delayMs={index * 90}
                  className="rounded-3xl border border-slate-200 bg-[#f9fbfe] p-7 shadow-sm"
                >
                  <item.icon className="h-7 w-7 text-slate-700" />
                  <h3 className="mt-5 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.copy}</p>
                </Reveal>
              ))}
            </div>

            <Reveal delayMs={140} className="mt-12">
              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-900 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                    Platform Montage
                  </p>
                  <p className="text-xs text-slate-400">Live product flow</p>
                </div>
                <div className="relative aspect-[16/9]">
                  <video
                    ref={solutionVideoRef}
                    className="hidden h-full w-full object-cover md:block"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    poster={SOLUTION_MONTAGE_POSTER_URL}
                  >
                    <source src={SOLUTION_MONTAGE_VIDEO_SRC} type="video/mp4" />
                  </video>
                  <img
                    src={SOLUTION_MONTAGE_POSTER_URL}
                    alt="Product montage preview"
                    className="h-full w-full object-cover md:hidden"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-slate-900/20" />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-slate-900 py-20 text-slate-100 sm:py-24">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 sm:px-8 lg:grid-cols-[1fr_1fr]">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Trust & Safety</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Designed for Trust, Not Chance
              </h2>
              <div className="mt-7 space-y-4">
                {[
                  {
                    icon: CheckCircle2,
                    text: "Verified university-email access to preserve a student-only network.",
                  },
                  {
                    icon: Scale,
                    text: "Clear code of conduct and transparent accountability expectations.",
                  },
                  {
                    icon: Star,
                    text: "Rating and reputation signals that improve decision quality over time.",
                  },
                  {
                    icon: Workflow,
                    text: "Structured mediation framework for issue handling and resolution.",
                  },
                ].map((point) => (
                  <div key={point.text} className="flex items-start gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/60 p-4">
                    <point.icon className="mt-0.5 h-5 w-5 text-slate-200" />
                    <p className="text-sm leading-relaxed text-slate-200">{point.text}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delayMs={120} className="flex items-center">
              <div
                className="w-full rounded-[28px] border border-slate-700/60 bg-slate-800/70 p-5 shadow-2xl"
                style={{ animation: "aboutMockupFloat 6s ease-in-out infinite" }}
              >
                <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Safety Snapshot</p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3 text-sm">
                      <span>University email verified</span>
                      <span className="font-semibold text-emerald-300">Confirmed</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3 text-sm">
                      <span>Community reputation</span>
                      <span className="font-semibold text-slate-100">4.8 / 5.0</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3 text-sm">
                      <span>Support protocol status</span>
                      <span className="font-semibold text-blue-200">Structured</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-[#f5f8fc] py-20 sm:py-24">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
            <Reveal className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">University Integration</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Housing Infrastructure for Modern Universities
              </h2>
              <p className="mt-6 text-base leading-relaxed text-slate-700">
                We are building SaaS-ready housing infrastructure that helps institutions activate bridge housing for arrivals, absorb overflow demand during peaks, and accelerate operational integration with minimal implementation friction.
              </p>
            </Reveal>

            <Reveal delayMs={120} className="mt-12 rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
              <div className="relative grid gap-4 md:grid-cols-4">
                {[
                  { title: "Student Intake", subtitle: "Arrival wave begins" },
                  { title: "Bridge Capacity", subtitle: "Verified couch and spare-room supply activated" },
                  { title: "Operational Layer", subtitle: "Verification, rules, mediation" },
                  { title: "Institution Dashboard", subtitle: "Visibility and oversight potential" },
                ].map((step, index) => (
                  <div key={step.title} className="relative rounded-2xl border border-slate-200 bg-[#f9fbfe] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Step {index + 1}</p>
                    <h3 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{step.subtitle}</p>
                  </div>
                ))}
                <div
                  className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-slate-300 md:block"
                  style={{ animation: "aboutLineFlow 4.5s ease-in-out infinite" }}
                />
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 justify-around md:flex">
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      className="h-2 w-2 rounded-full bg-slate-500"
                      style={{ animation: "aboutPulse 2.3s ease-in-out infinite", animationDelay: `${dot * 0.35}s` }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-4">
                  <p className="text-sm font-semibold text-slate-900">Emergency Overflow Capacity</p>
                  <p className="mt-1 text-sm text-slate-600">Rapid activation for high-pressure periods and late arrivals.</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-4">
                  <p className="text-sm font-semibold text-slate-900">Institutional Integration Acceleration</p>
                  <p className="mt-1 text-sm text-slate-600">Framework designed to connect with university support operations.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <video
              ref={visionVideoRef}
              className="hidden h-full w-full object-cover md:block"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={VISION_POSTER_URL}
            >
              <source src={VISION_VIDEO_SRC} type="video/mp4" />
            </video>
            <img
              src={VISION_POSTER_URL}
              alt="Students in Lausanne by the lake"
              className="h-full w-full object-cover md:hidden"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-slate-900/56" />
          </div>

          <div className="relative mx-auto max-w-6xl px-6 py-24 sm:px-8 sm:py-28">
            <div className="max-w-3xl" style={{ transform: `translateY(${visionOffset}px)` }}>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">Vision</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Housing Built By Students
              </h2>
              <p className="mt-6 text-base leading-relaxed text-slate-200 sm:text-lg">
                Access to education should never be blocked by housing gaps. We are building a trusted student housing network that scales city by city, supports university ecosystems, and uses existing resources more sustainably than traditional expansion alone.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-200 sm:text-lg">
                Starting in Lausanne, our roadmap is European: a reliable, student-centered housing layer that institutions can work with, and students can depend on.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-white px-7 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                  onClick={() => {
                    window.location.href = "mailto:partnerships@couch-share.com?subject=University%20Partnership";
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Partner With Us
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-slate-300/70 bg-transparent px-7 text-sm font-semibold text-white hover:bg-white/10"
                  onClick={() => navigate(user ? "/listings" : "/auth")}
                >
                  Join the Network
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;

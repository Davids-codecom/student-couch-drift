import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";

const HERO_VIDEO_SRC =
  "https://videos.pexels.com/video-files/5152196/5152196-hd_1920_1080_25fps.mp4";
const HERO_POSTER_URL =
  "https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&w=2200&q=85";
const SOLUTION_MONTAGE_POSTER_URL =
  "/images/platform-montage-poster.jpg";
const SOLUTION_FLOW_SLIDES = [
  {
    title: "Book a place",
    src: "/images/about-book-a-place.png",
    alt: "Book a place screen",
  },
  {
    title: "Manage reservations",
    src: "/images/about-manage-reservations.png",
    alt: "Manage reservations screen",
  },
  {
    title: "Map view",
    src: "/images/about-map-view.png",
    alt: "Map view screen",
  },
] as const;
const VISION_VIDEO_SRC =
  "https://videos.pexels.com/video-files/3184428/3184428-hd_1920_1080_24fps.mp4";
const VISION_POSTER_URL =
  "https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=2200&q=85";
const CLOSED_ECOSYSTEM_OPEN_NETWORK_IMAGE =
  "/closed_ecosystem_open_network.png?v=2";
const AVERAGE_NIGHTLY_PRICE_CHF = 36;
const DEFAULT_NIGHTS = 7;

const pageMotion = `
  @keyframes aboutFadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes aboutMockupFloat {
    0% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
    100% { transform: translateY(0); }
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
  const [isEarningsDialogOpen, setIsEarningsDialogOpen] = useState(false);
  const [estimatedNights, setEstimatedNights] = useState(DEFAULT_NIGHTS);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const visionVideoRef = useRef<HTMLVideoElement | null>(null);
  const solutionCarouselRef = useRef<HTMLDivElement | null>(null);
  const [solutionSlideIndex, setSolutionSlideIndex] = useState(0);
  const [carouselInteractionTick, setCarouselInteractionTick] = useState(0);
  const [isCarouselInteracting, setIsCarouselInteracting] = useState(false);

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
    if (visionVideoRef.current) {
      visionVideoRef.current.playbackRate = 0.85;
    }
  }, []);

  const scrollToSolutionSlide = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const container = solutionCarouselRef.current;
      if (!container) return;
      const total = SOLUTION_FLOW_SLIDES.length;
      const normalized = ((index % total) + total) % total;
      container.scrollTo({
        left: normalized * container.clientWidth,
        behavior,
      });
      setSolutionSlideIndex(normalized);
    },
    [],
  );

  useEffect(() => {
    if (isCarouselInteracting) return;
    const timer = window.setTimeout(() => {
      scrollToSolutionSlide(solutionSlideIndex + 1);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [carouselInteractionTick, isCarouselInteracting, scrollToSolutionSlide, solutionSlideIndex]);

  useEffect(() => {
    const onResize = () => {
      scrollToSolutionSlide(solutionSlideIndex, "auto");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [scrollToSolutionSlide, solutionSlideIndex]);

  const heroOffset = useMemo(() => Math.min(scrollY * 0.08, 42), [scrollY]);
  const visionOffset = useMemo(() => Math.min(scrollY * 0.05, 26), [scrollY]);
  const estimatedEarnings = useMemo(
    () => estimatedNights * AVERAGE_NIGHTLY_PRICE_CHF,
    [estimatedNights],
  );

  const openCouchShareFlow = useCallback(() => {
    if (user) {
      navigate("/listings");
      return;
    }
    setIsEarningsDialogOpen(true);
  }, [navigate, user]);

  const continueToSignUp = useCallback(() => {
    setIsEarningsDialogOpen(false);
    navigate("/auth?mode=signup");
  }, [navigate]);

  return (
    <div className="bg-[#f6f8fb] text-slate-900">
      <style>{pageMotion}</style>

      <main>
        <section className="relative min-h-[82vh] overflow-hidden">
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
            className="relative mx-auto flex min-h-[82vh] w-full max-w-6xl items-center px-6 py-16 sm:px-8 sm:py-20"
            style={{ transform: `translateY(${heroOffset}px)` }}
          >
            <div className="max-w-[68ch]">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-200">
                Lausanne · Switzerland
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Student Housing That Actually Works
              </h1>
              <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-slate-200 sm:text-lg">
                A trusted student-to-student network for short stays near campus.
              </p>
              <div className="mt-7 flex flex-wrap gap-3.5">
                <Button
                  className="min-w-[220px] justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100 sm:px-7 sm:py-3.5 sm:text-base"
                  onClick={openCouchShareFlow}
                >
                  Couch-share your place <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="min-w-[220px] justify-center rounded-full border-slate-200/70 bg-transparent px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:px-7 sm:py-3.5 sm:text-base"
                  onClick={() => {
                    window.location.href = "mailto:partnerships@couch-share.com?subject=University%20Partnership";
                  }}
                >
                  Partner with Couch-Share
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#f7f9fc] py-14 sm:py-16">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-6 sm:gap-8 sm:px-8 lg:items-center lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Reveal className="max-w-[36ch]">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">The Challenge</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Housing Demand Outruns Supply
              </h2>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:gap-5">
              <CounterCard value={41} suffix="%" label="Students facing housing pressure in peak intake periods." />
              <CounterCard value={6} suffix="w" label="Average search time before stable placement." />
              <CounterCard value={3} prefix="+" suffix=" years" label="Typical lead time for new housing delivery." />
              <CounterCard value={24} suffix="/7" label="Support availability students expect during issues." />
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-6 sm:px-8">
            <Reveal className="mx-auto max-w-[70ch] text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">How It Works</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Unlock Spare Capacity, Fast
              </h2>
              <p className="mt-6 text-base leading-relaxed text-slate-700">
                Verified students share <span className="font-semibold text-slate-900">couches</span> and{" "}
                <span className="font-semibold text-slate-900">spare rooms</span> within their university network, making
                short-term housing available much faster.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: GraduationCap,
                  title: "Campus-Only Network",
                  copy: "Each university runs a closed, student-verified ecosystem.",
                },
                {
                  icon: ShieldCheck,
                  title: "Verified Exchanges",
                  copy: "University email access, clear rules, and accountable behavior.",
                },
                {
                  icon: Wallet,
                  title: "Student-Friendly Pricing",
                  copy: "Flexible stay lengths and rates aligned with student budgets.",
                },
              ].map((item, index) => (
                <Reveal
                  key={item.title}
                  delayMs={index * 90}
                  className="rounded-3xl border border-slate-200 bg-[#f9fbfe] p-6 shadow-sm"
                >
                  <item.icon className="h-7 w-7 text-slate-700" />
                  <h3 className="mt-5 text-xl font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.copy}</p>
                </Reveal>
              ))}
            </div>

            <Reveal delayMs={140} className="mx-auto mt-12 w-full max-w-[768px]">
              <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-slate-900 shadow-lg">
                <div className="relative aspect-[3/2]">
                  <div
                    ref={solutionCarouselRef}
                    className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none" }}
                    onScroll={(event) => {
                      const target = event.currentTarget;
                      if (!target.clientWidth) return;
                      const nextIndex = Math.round(target.scrollLeft / target.clientWidth);
                      setSolutionSlideIndex(Math.min(Math.max(nextIndex, 0), SOLUTION_FLOW_SLIDES.length - 1));
                    }}
                    onPointerDown={() => {
                      setIsCarouselInteracting(true);
                      setCarouselInteractionTick((value) => value + 1);
                    }}
                    onPointerUp={() => {
                      setIsCarouselInteracting(false);
                      setCarouselInteractionTick((value) => value + 1);
                    }}
                    onPointerCancel={() => {
                      setIsCarouselInteracting(false);
                      setCarouselInteractionTick((value) => value + 1);
                    }}
                    onPointerLeave={() => {
                      setIsCarouselInteracting(false);
                    }}
                  >
                    {SOLUTION_FLOW_SLIDES.map((slide) => (
                      <div
                        key={slide.title}
                        className="relative flex h-full w-full shrink-0 snap-start items-center justify-center bg-[#edf2ff]"
                      >
                        <img
                          src={slide.src}
                          alt={slide.alt}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          onError={(event) => {
                            if (event.currentTarget.dataset.fallbackApplied === "true") return;
                            event.currentTarget.dataset.fallbackApplied = "true";
                            event.currentTarget.src = SOLUTION_MONTAGE_POSTER_URL;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-slate-900 py-16 text-slate-100 sm:py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 sm:px-8 lg:grid-cols-[1.25fr_1fr]">
            <Reveal className="max-w-[72ch]">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Trust & Safety</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Safety by Design
              </h2>
              <p className="mt-5 max-w-[70ch] text-sm leading-relaxed text-slate-300 sm:text-base">
                Safety is built into access, conduct, reputation, and support.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  {
                    icon: CheckCircle2,
                    text: "Student-only access through university identity checks.",
                  },
                  {
                    icon: Scale,
                    text: "Shared conduct standards for hosts and renters.",
                  },
                  {
                    icon: Star,
                    text: "Transparent reviews and stay history after each booking.",
                  },
                  {
                    icon: Workflow,
                    text: "Escalation and mediation when conflicts arise.",
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
                      <span>University Email</span>
                      <span className="font-semibold text-emerald-300">Verified</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3 text-sm">
                      <span>Reputation Score</span>
                      <span className="font-semibold text-slate-100">4.8 / 5.0</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-800 p-3 text-sm">
                      <span>Support Protocol</span>
                      <span className="font-semibold text-blue-200">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-[#f5f8fc] py-12 sm:py-14">
          <div className="mx-auto w-full max-w-6xl px-6 sm:px-8">
            <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10">
              <Reveal className="mx-auto max-w-[42ch] text-center lg:mx-0 lg:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">UNIVERSITY OPERATIONS</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  Open the Network to Selected Partner Universities
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-700">
                  Keep a closed ecosystem by default, then open access to approved partner universities. Students can travel
                  and stay with verified hosts across campuses at a budget-friendly price.
                </p>
              </Reveal>

      <Reveal delayMs={120} className="w-full">
        <img
          src={CLOSED_ECOSYSTEM_OPEN_NETWORK_IMAGE}
          alt="Closed ecosystem opened to selected partner universities, showing UNIL connected with HSG, UNIGE, UNIBE, and ETH Zurich."
          className="mx-auto h-auto w-full max-w-[900px] object-contain lg:ml-auto"
          width={1536}
          height={1024}
          loading="lazy"
          decoding="async"
        />
      </Reveal>
            </div>
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

          <div className="relative mx-auto max-w-6xl px-6 py-20 sm:px-8 sm:py-24">
            <div className="max-w-[70ch]" style={{ transform: `translateY(${visionOffset}px)` }}>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Built in Lausanne, Ready to Scale
              </h2>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="rounded-full border-slate-300/70 bg-transparent px-7 text-sm font-semibold text-white hover:bg-white/10"
                  onClick={() => {
                    window.location.href = "mailto:partnerships@couch-share.com?subject=University%20Partnership";
                  }}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Partner with Couch-Share
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={isEarningsDialogOpen} onOpenChange={setIsEarningsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-3xl font-semibold tracking-tight text-slate-900">
              Couch-share it. You could earn
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              {DEFAULT_NIGHTS} nights at an average CHF {AVERAGE_NIGHTLY_PRICE_CHF} per night.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <p className="text-center text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
              CHF {estimatedEarnings}
            </p>
            <p className="text-center text-base text-slate-600">
              <span className="font-semibold text-slate-900">{estimatedNights} nights</span> at an estimated CHF{" "}
              {AVERAGE_NIGHTLY_PRICE_CHF} a night
            </p>

            <Slider
              value={[estimatedNights]}
              min={1}
              max={30}
              step={1}
              onValueChange={(value) => setEstimatedNights(value[0] ?? DEFAULT_NIGHTS)}
              aria-label="Estimated nights"
            />

            <Button
              className="w-full rounded-full bg-slate-900 py-6 text-base font-semibold text-white hover:bg-slate-800"
              onClick={continueToSignUp}
            >
              Sign up
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandingPage;

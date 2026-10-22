import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Image,
  Layers3,
  Lock,
  Megaphone,
  PenLine,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wand2,
} from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Badge, buttonClass, Card, InlineCheck } from "@/components/ui";

const stages = [
  { icon: FileText, label: "Intake", detail: "Normalise the brief. Name the gaps." },
  { icon: Target, label: "Strategy", detail: "Positioning, message, success metric." },
  { icon: Users, label: "Audience", detail: "Segments and objections, sourced or flagged." },
  { icon: PenLine, label: "Copy", detail: "Channel copy, validated against real limits." },
  { icon: Image, label: "Creative", detail: "Brand-true templates. Editable text." },
  { icon: Search, label: "Landing page", detail: "Destination, tracking and CTA readiness." },
  { icon: Layers3, label: "Assembly", detail: "A platform-neutral draft you can inspect." },
  { icon: ClipboardCheck, label: "Quality", detail: "An independent review before you decide." },
];

const guardrails = [
  {
    title: "Approval is bound to a version",
    body: "The exact brief, artifacts and budget are hashed. Change one thing and the approval is void — not quietly reused.",
    icon: Lock,
  },
  {
    title: "No fabricated evidence",
    body: "When research or testimonials are missing, Tulivu says so. It does not invent performance numbers or customer quotes.",
    icon: ShieldCheck,
  },
  {
    title: "Publishing has a hard boundary",
    body: "This demo creates clearly labelled simulated resources. Live Meta and Google adapters are not implemented and cannot accidentally spend money.",
    icon: Megaphone,
  },
  {
    title: "A quality review that can fail",
    body: "Deterministic checks run first. Warnings must be acknowledged; blocking failures cannot be approved away.",
    icon: CircleAlert,
  },
];

function HeroPreview() {
  const rows = [
    { label: "Intake & requirements", state: "done" },
    { label: "Marketing strategy", state: "done" },
    { label: "Audience & research", state: "done" },
    { label: "Campaign & copy", state: "done" },
    { label: "Creative production", state: "done" },
    { label: "Conversion readiness", state: "done" },
    { label: "Campaign assembly", state: "done" },
    { label: "Quality review", state: "warn" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-gold/15 blur-3xl" aria-hidden />
      <div className="absolute -right-5 -top-5 hidden rotate-3 rounded-xl border border-forest/10 bg-paper px-3.5 py-2.5 shadow-soft sm:block">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Human gate</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-forest">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Approval required
        </p>
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-[#fffdf8] shadow-lift">
        <div className="flex items-center justify-between border-b border-line bg-paper/80 px-5 py-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
          </div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Campaign workspace</p>
          <Badge tone="gold" className="px-2 py-0.5 text-[8px]">
            Demo
          </Badge>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Mkono Skincare · KES</p>
              <h3 className="mt-1.5 text-xl leading-tight text-forest">Barrier Repair Launch</h3>
              <p className="mt-1 text-[11px] text-muted">Nairobi & Mombasa · 14 days · Meta + Google</p>
            </div>
            <div className="relative h-[62px] w-[62px] shrink-0 rounded-full" style={{ background: "conic-gradient(#244d40 0 90%, #e5e0d5 90% 100%)" }}>
              <div className="absolute inset-[5px] flex flex-col items-center justify-center rounded-full bg-[#fffdf8]">
                <span className="font-display text-lg leading-none text-forest">90</span>
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-wider text-[#8a6d27]">Warn</span>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-1.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 rounded-lg px-2 py-[5px] odd:bg-forest/[0.025]">
                {row.state === "warn" ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#d8bd7e] bg-[#fbf3df]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#b18d35]" />
                  </span>
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-forest text-ivory">
                    <Check className="h-2.5 w-2.5" aria-hidden />
                  </span>
                )}
                <span className="flex-1 text-[11px] font-medium text-ink">{row.label}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted/70">
                  {row.state === "warn" ? "Review" : "Done"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-gold-deep/30 bg-gold/[0.13] p-3.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-gold">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-forest">One warning needs your acknowledgement</p>
                <p className="mt-0.5 text-[10px] leading-4 text-muted">Meta primary text may truncate after 125 characters.</p>
              </div>
              <span className="rounded-lg bg-forest px-2.5 py-1.5 text-[9px] font-bold text-ivory">Review</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 left-3 flex items-center gap-2 rounded-full border border-line bg-[#fffdf8] px-3 py-2 shadow-soft sm:-left-6">
        <span className="h-1.5 w-1.5 rounded-full bg-clay" aria-hidden />
        <p className="text-[10px] font-semibold text-ink">Simulated resources only</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-ivory">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory/85 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="Tulivu home">
            <Wordmark showTagline />
          </Link>
          <nav className="hidden items-center gap-7 text-[12px] font-semibold text-muted md:flex" aria-label="Landing">
            <a href="#how-it-works" className="transition hover:text-forest">How it works</a>
            <a href="#guardrails" className="transition hover:text-forest">Guardrails</a>
            <a href="#demo" className="transition hover:text-forest">The demo</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/app/overview"
              className={buttonClass({ size: "md", className: "h-9 px-3.5 text-xs sm:px-4" })}
            >
              Open the demo
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------------------------- hero --------------------------------- */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse 55% 60% at 82% 28%, rgba(217,197,141,0.25), transparent 70%), radial-gradient(ellipse 40% 50% at 8% 0%, rgba(36,77,64,0.07), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pb-28 lg:pt-20">
            <div className="animate-rise">
              <div className="inline-flex items-center gap-2 rounded-full border border-forest/12 bg-[#fffdf8]/80 px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-gold-deep" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
                  Growth agent with a human gate · demo
                </span>
              </div>

              <h1 className="mt-6 max-w-[640px] text-[2.75rem] leading-[1.03] tracking-[-0.03em] text-forest sm:text-[3.65rem]">
                From a rough brief to a campaign worth{" "}
                <span className="relative inline-block italic">
                  reviewing
                  <svg
                    viewBox="0 0 220 12"
                    className="absolute -bottom-1 left-0 w-full text-gold"
                    fill="none"
                    aria-hidden
                  >
                    <path d="M2 8.5C48 4.5 128 2 218 6.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </span>
                .
              </h1>

              <p className="mt-6 max-w-[560px] text-[15px] leading-7 text-muted">
                Tulivu turns a business brief into strategy, audience thinking, channel-ready copy, creatives and a
                quality review — then stops. You inspect the exact package and decide what happens next.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/app/overview" className={buttonClass({ size: "lg" })}>
                  <Play className="h-4 w-4" aria-hidden />
                  Explore the live workspace
                </Link>
                <a href="#how-it-works" className={buttonClass({ variant: "secondary", size: "lg" })}>
                  See the eight stages
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
                <InlineCheck>No sign-up</InlineCheck>
                <InlineCheck>Private demo session</InlineCheck>
                <InlineCheck>No live ad spend</InlineCheck>
              </div>

              <p className="mt-6 max-w-lg border-l-2 border-gold pl-3 text-[11px] leading-5 text-muted">
                This is a product demo. Advertising execution is simulated and clearly labelled. Nothing is published to
                Meta or Google.
              </p>
            </div>

            <div className="animate-rise lg:pl-2" style={{ animationDelay: "120ms" }}>
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* ------------------------------- value strip ------------------------------ */}
        <section className="border-y border-line bg-[#fffdf8]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-4 sm:px-6 lg:grid-cols-4 lg:divide-x">
            {[
              { value: "8", label: "bounded workflow stages" },
              { value: "1", label: "human approval gate" },
              { value: "0", label: "invented performance claims" },
              { value: "100%", label: "demo-safe execution" },
            ].map((item, index) => (
              <div key={item.label} className={`px-2 py-7 sm:px-6 ${index % 2 === 0 ? "border-r border-line lg:border-r-0" : ""} ${index < 2 ? "border-b border-line lg:border-b-0" : ""}`}>
                <p className="font-display text-3xl text-forest">{item.value}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------- how it works ------------------------------ */}
        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="tulivu-label text-gold-deep">The work, not the theatre</p>
              <h2 className="mt-4 max-w-md text-4xl leading-[1.08] tracking-[-0.025em] text-forest sm:text-5xl">
                A calm system for an impatient job.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-muted">
                Most campaign tools generate more surface area. Tulivu narrows the problem: understand the brief,
                produce the package, pressure-test it, and hand a bounded decision to a person.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <Badge tone="forest">Bounded</Badge>
                <Badge tone="forest">Auditable</Badge>
                <Badge tone="forest">Resumable</Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Bring the truth",
                  body: "A business profile and a campaign brief. Tulivu records what is missing instead of filling gaps with fiction.",
                  icon: FileText,
                },
                {
                  step: "2",
                  title: "Let the agent work",
                  body: "Eight stages produce versioned artifacts: strategy, segments, copy, creatives, a destination check and a draft.",
                  icon: Wand2,
                },
                {
                  step: "03",
                  title: "Make the call",
                  body: "Read the quality review, edit what needs editing, acknowledge warnings and approve one exact version.",
                  icon: ShieldCheck,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.step} className="relative flex flex-col p-5">
                    <span className="font-display text-2xl text-gold-deep/70">{item.step}</span>
                    <span className="mt-5 flex h-9 w-9 items-center justify-center rounded-full bg-forest/[0.06] text-forest">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg leading-tight text-forest">{item.title}</h3>
                    <p className="mt-2 text-[12px] leading-6 text-muted">{item.body}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* -------------------------------- workflow -------------------------------- */}
        <section className="tulivu-grain bg-forest py-20 text-ivory lg:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold">The workflow</p>
                <h2 className="mt-3 max-w-2xl text-4xl leading-[1.08] tracking-[-0.025em] text-ivory sm:text-5xl">
                  Eight stages. One clear hand-off.
                </h2>
              </div>
              <p className="max-w-sm text-xs leading-6 text-ivory/55">
                Every stage writes a typed, versioned artifact. A failed stage can be retried or resumed without
                pretending the earlier work did not happen.
              </p>
            </div>

            <div className="mt-12 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-4">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.label}
                    className="group border-t border-ivory/12 py-5 transition-colors hover:border-gold/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ivory/15 text-gold transition group-hover:border-gold/40 group-hover:bg-gold/10">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="text-[9px] font-bold tracking-[0.16em] text-ivory/25">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="mt-4 text-[15px] font-semibold text-ivory">{stage.label}</h3>
                    <p className="mt-1.5 text-[11px] leading-5 text-ivory/45">{stage.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 rounded-xl border border-gold/20 bg-gold/[0.07] px-4 py-3">
              <Lock className="h-4 w-4 shrink-0 text-gold" aria-hidden />
              <p className="text-[11px] leading-5 text-ivory/60">
                The workflow never approves its own work. Approval and demo execution are separate, explicit actions.
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------- guardrails ------------------------------- */}
        <section id="guardrails" className="scroll-mt-24 border-b border-line bg-[#fffdf8] py-20 lg:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <p className="tulivu-label text-gold-deep">Built to stop</p>
                <h2 className="mt-4 max-w-md text-4xl leading-[1.08] tracking-[-0.025em] text-forest sm:text-5xl">
                  Confidence comes from the boundaries.
                </h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-muted">
                  Tulivu is not designed to produce the most output. It is designed to produce work that can survive a
                  careful read — and to refuse the parts it cannot honestly do.
                </p>

                <div className="mt-8 rounded-2xl border border-line bg-ivory/70 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted">This workspace</p>
                      <p className="mt-1 text-sm font-semibold text-forest">Mock model · demo ads</p>
                    </div>
                    <Badge tone="gold">Safe by default</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[10px]">
                    <span className="rounded-lg bg-forest/[0.05] px-2.5 py-2 text-forest">Model: deterministic mock</span>
                    <span className="rounded-lg bg-forest/[0.05] px-2.5 py-2 text-forest">Research: not configured</span>
                    <span className="rounded-lg bg-forest/[0.05] px-2.5 py-2 text-forest">Publishing: simulated</span>
                    <span className="rounded-lg bg-forest/[0.05] px-2.5 py-2 text-forest">Data: isolated session</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {guardrails.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.title} className="p-5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-[#7a6328]">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <h3 className="mt-4 text-[15px] leading-snug text-forest">{item.title}</h3>
                      <p className="mt-2 text-[11px] leading-5 text-muted">{item.body}</p>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="mt-14 overflow-hidden rounded-2xl border border-line bg-ivory">
              <div className="grid sm:grid-cols-[1fr_auto]">
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-gold">
                      <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-forest">Quality review · version 3</p>
                    <Badge tone="warning">Warn · 90</Badge>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {[
                      { label: "Claims match supplied facts", state: "pass" },
                      { label: "Destination URL syntax is valid", state: "pass" },
                      { label: "Meta primary text length", state: "warn" },
                      { label: "Approval bound to this version", state: "pass" },
                    ].map((check) => (
                      <div
                        key={check.label}
                        className="flex items-center gap-2 rounded-lg border border-line bg-[#fffdf8] px-3 py-2.5"
                      >
                        {check.state === "pass" ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden />
                        ) : (
                          <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[#a5812e]" aria-hidden />
                        )}
                        <span className="text-[11px] font-medium text-ink">{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-center border-t border-line bg-paper px-8 py-6 sm:border-l sm:border-t-0">
                  <div className="text-center">
                    <p className="font-display text-5xl text-forest">90</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Quality score</p>
                    <p className="mt-2 max-w-[140px] text-[10px] leading-4 text-muted">A warning, not a hidden pass.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------- demo ---------------------------------- */}
        <section id="demo" className="relative scroll-mt-24 overflow-hidden py-20 lg:py-28">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: "radial-gradient(ellipse 50% 60% at 50% 100%, rgba(217,197,141,0.24), transparent 70%)" }}
            aria-hidden
          />
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-forest/12 bg-paper px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-forest">
                <Play className="h-3 w-3 text-gold-deep" aria-hidden />
                Try the full loop
              </span>
              <h2 className="mt-5 text-4xl leading-[1.06] tracking-[-0.03em] text-forest sm:text-[3.4rem]">
                A real campaign workspace. A deliberately fake launch.
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted">
                Open the seeded Mkono Skincare workspace, run the agent, read the quality review and take it all the way
                to a simulated launch. No account, credentials or ad spend required.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link to="/app/overview" className={buttonClass({ size: "lg" })}>
                  Enter the demo workspace
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to="/app/campaigns/new" className={buttonClass({ variant: "secondary", size: "lg" })}>
                  Start from a blank brief
                </Link>
              </div>
            </div>

            <div className="mx-auto mt-14 grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                { number: "1", title: "Open the seeded campaign", text: "A complete brief and business profile are ready to run." },
                { number: "2", title: "Run and review", text: "Watch the stages complete, then inspect every artifact." },
                { number: "3", title: "Approve, then simulate", text: "See the version-bound gate and clearly labelled demo resources." },
              ].map((item) => (
                <Card key={item.number} quiet className="p-5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-gold">
                    {item.number}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-forest">{item.title}</h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-muted">{item.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-[#fffdf8]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-sm text-[11px] leading-5 text-muted">
              A marketing agent with a human approval gate. Built as a transparent, demo-first product.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-[10px] text-muted md:items-end">
            <div className="flex flex-wrap gap-4">
              <Link to="/app/overview" className="font-semibold text-forest hover:underline">Demo workspace</Link>
              <Link to="/app/settings" className="font-semibold text-forest hover:underline">Settings</Link>
              <a href="#how-it-works" className="font-semibold text-forest hover:underline">How it works</a>
            </div>
            <p className="max-w-sm md:text-right">
              No real Meta or Google publishing. No fabricated research or performance data. Demo resources are paused
              and labelled.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

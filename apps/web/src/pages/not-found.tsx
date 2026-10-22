import { Link } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { buttonClass } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-gold/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-sage/60 blur-3xl" aria-hidden />

      <div className="relative w-full max-w-lg text-center">
        <Link to="/" className="inline-flex" aria-label="Tulivu home">
          <Wordmark />
        </Link>
        <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper text-forest mx-auto">
          <Compass className="h-6 w-6" aria-hidden />
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-deep">404 · Off the map</p>
        <h1 className="mt-2 text-4xl leading-tight tracking-[-0.03em] text-forest">
          This page has wandered.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
          The address does not match a page in this demo. It may have moved, or the link may be incomplete. Nothing was
          lost.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link to="/app/overview" className={buttonClass()}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to the workspace
          </Link>
          <Link to="/" className={buttonClass({ variant: "secondary" })}>
            View the landing page
          </Link>
        </div>
      </div>
    </main>
  );
}

import { useEffect, useState, type ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Building2,
  ChevronRight,
  LayoutDashboard,
  Megaphone,
  Menu,
  Palette,
  Plus,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@tulivu/shared";
import { Wordmark, LeafMark } from "./brand";
import { Badge, buttonClass, IconButton } from "./ui";
import { useOverview } from "@/lib/queries";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  badge?: number;
}

function navItems(awaitingApproval: number): NavItem[] {
  return [
    { to: "/app/overview", label: "Overview", icon: LayoutDashboard },
    { to: "/app/businesses", label: "Businesses", icon: Building2 },
    { to: "/app/campaigns", label: "Campaigns", icon: Megaphone, badge: awaitingApproval },
    { to: "/app/studio", label: "Creative studio", icon: Palette },
    { to: "/app/activity", label: "Activity", icon: Activity },
  ];
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const overview = useOverview();
  const waiting = overview.data?.metrics.awaitingApproval ?? 0;
  const workspaceName = overview.data?.workspace.name ?? "Demo workspace";

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Link to="/" onClick={onNavigate} className="inline-flex" aria-label="Tulivu home">
          <Wordmark inverse showTagline />
        </Link>
      </div>

      <div className="mx-4 rounded-xl border border-ivory/10 bg-ivory/[0.055] px-3.5 py-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-ivory/40">Workspace</p>
        <p className="mt-1 truncate text-sm font-semibold text-ivory/90">{workspaceName}</p>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-gold/90">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
          Demo · isolated session
        </div>
      </div>

      <nav className="mt-6 flex-1 space-y-1 px-3" aria-label="Main">
        {navItems(waiting).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
                  isActive
                    ? "bg-ivory/[0.11] text-ivory shadow-inner"
                    : "text-ivory/60 hover:bg-ivory/[0.06] hover:text-ivory",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn("h-[17px] w-[17px] transition", isActive ? "text-gold" : "text-ivory/45 group-hover:text-ivory/75")}
                    aria-hidden
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-forest">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="mx-4 mb-3 rounded-xl border border-gold/20 bg-gold/[0.07] p-3.5">
        <div className="flex items-center gap-2 text-gold">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Human in the loop</p>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-ivory/55">
          Tulivu prepares the work. You approve the exact version. Publishing stays simulated in this demo.
        </p>
      </div>

      <div className="border-t border-ivory/10 px-3 py-3">
        <NavLink
          to="/app/settings"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
              isActive ? "bg-ivory/[0.11] text-ivory" : "text-ivory/60 hover:bg-ivory/[0.06] hover:text-ivory",
            )
          }
        >
          <Settings className="h-[17px] w-[17px] text-ivory/45" aria-hidden />
          Settings
        </NavLink>
        <p className="mt-2 flex items-center gap-1.5 px-3 text-[10px] text-ivory/30">
          <LeafMark className="h-3 w-3" />
          Calm software for loud markets.
        </p>
      </div>
    </div>
  );
}

function pageLabel(pathname: string): string {
  if (pathname === "/app/overview") return "Overview";
  if (pathname.startsWith("/app/businesses")) return "Businesses";
  if (pathname === "/app/campaigns/new") return "New campaign";
  if (pathname.startsWith("/app/campaigns/")) return "Campaign workspace";
  if (pathname === "/app/campaigns") return "Campaigns";
  if (pathname === "/app/studio") return "Creative studio";
  if (pathname === "/app/activity") return "Activity";
  if (pathname === "/app/settings") return "Settings";
  return "Workspace";
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const label = pageLabel(location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-ivory">
      <aside className="tulivu-grain fixed inset-y-0 left-0 z-40 hidden w-[258px] flex-col bg-forest lg:flex">
        <SidebarContent />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade bg-forest/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="tulivu-grain animate-rise absolute inset-y-0 left-0 flex w-[286px] flex-col bg-forest shadow-lift">
            <div className="flex items-center justify-between pr-3">
              <div className="flex-1">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
            <IconButton
              label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 border-ivory/10 text-ivory/60 hover:bg-ivory/10 hover:text-ivory"
            >
              <X className="h-4 w-4" aria-hidden />
            </IconButton>
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[258px]">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-ivory/90 backdrop-blur-md lg:bg-ivory/75">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
            <IconButton
              label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </IconButton>

            <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
              <span className="hidden text-muted sm:inline">Workspace</span>
              <ChevronRight className="hidden h-3.5 w-3.5 text-muted/50 sm:inline" aria-hidden />
              <span className="truncate font-semibold text-forest">{label}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Badge tone="gold" className="hidden sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-deep" aria-hidden />
                Demo mode
              </Badge>
              <Link to="/app/campaigns/new" className={buttonClass({ size: "md", className: "h-9 px-3.5" })}>
                <Plus className="h-4 w-4" aria-hidden />
                <span className="hidden xs:inline sm:inline">New campaign</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <Outlet />
        </main>

        <footer className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-2 px-4 pb-8 pt-2 text-[10px] text-muted sm:px-6 lg:px-10">
          <span>tulivu · demo workspace · no live advertising accounts connected</span>
          <span>Strategy to review, with a human approval gate.</span>
        </footer>
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Search, ShoppingBag, User, X, Globe, ChevronDown, ChevronRight, Truck, ShieldCheck, Headphones, Sparkles, LogOut, LayoutDashboard, Package, MapPin } from "lucide-react";
import { useCart } from "@/store/cart";
import { useAuth } from "@/store/auth";
import { useCurrency } from "@/store/currency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createRoutePrefetchHandlers, prefetchRoute } from "@/lib/routePrefetch";
import { isHeaderSurface, normalizeHeaderSurface, resolveHeaderSurfaceFromRects, type HeaderSurface } from "@/lib/headerTheme";
import { cn } from "@/lib/utils";
import { buildNav, type NavItem } from "./navData";
import edioLogo from "@/assets/edio-logo-original.png";

export function Logo({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/"
      {...createRoutePrefetchHandlers("/")}
      className={cn(
        "touch-target inline-flex items-center justify-center smooth hover:opacity-90 focus-visible:outline-primary",
        className,
      )}
      aria-label={t("common.home")}
    >
      <img src={edioLogo} alt="EDIO" className="h-11 w-11 object-contain drop-shadow-[0_10px_30px_hsl(var(--primary)/0.14)] md:h-10 md:w-10" />
    </Link>
  );
}

function useAdaptiveHeaderSurface() {
  const [surface, setSurface] = useState<HeaderSurface>("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    let frame = 0;
    let observer: IntersectionObserver | null = null;
    let observedSections = new Set<Element>();

    const applySurface = (nextSurface: string | null | undefined) => {
      const safeSurface = normalizeHeaderSurface(nextSurface, "dark");
      root.setAttribute("data-active-header-surface", safeSurface);
      root.setAttribute("data-active-header-theme", safeSurface === "light" ? "light" : "dark");
      setSurface((current) => (current === safeSurface ? current : safeSurface));
    };

    const getSurfaceSections = () =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          "main[data-header-surface], main[data-header-theme], main [data-header-surface], main [data-header-theme]",
        ),
      ).filter((section) => isHeaderSurface(section.dataset.headerSurface ?? section.dataset.headerTheme));

    const resolveSurface = () => {
      frame = 0;
      const sampleY = window.innerWidth < 768 ? 74 : 90;
      const sections = getSurfaceSections().map((section) => {
        const rect = section.getBoundingClientRect();
        return {
          surface: section.dataset.headerSurface,
          theme: section.dataset.headerTheme,
          top: rect.top,
          bottom: rect.bottom,
        };
      });

      applySurface(resolveHeaderSurfaceFromRects(sections, sampleY));
    };

    const scheduleResolve = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(resolveSurface);
    };

    const attachObserver = () => {
      observer?.disconnect();
      observedSections = new Set();

      const headerTop = window.innerWidth < 768 ? 38 : 42;
      const headerBand = window.innerWidth < 768 ? 80 : 96;
      const bottomMargin = Math.max(0, window.innerHeight - headerTop - headerBand);

      observer = new IntersectionObserver(scheduleResolve, {
        rootMargin: `-${headerTop}px 0px -${bottomMargin}px 0px`,
        threshold: [0, 0.01, 0.5, 1],
      });

      for (const section of getSurfaceSections()) {
        observer.observe(section);
        observedSections.add(section);
      }

      if (frame) window.cancelAnimationFrame(frame);
      resolveSurface();
    };

    const syncSections = () => {
      const sections = getSurfaceSections();
      const needsReattach =
        sections.length !== observedSections.size || sections.some((section) => !observedSections.has(section));
      if (needsReattach) attachObserver();
      else scheduleResolve();
    };

    const mutationObserver = new MutationObserver(syncSections);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", attachObserver);

    attachObserver();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", attachObserver);
      root.removeAttribute("data-active-header-surface");
      root.removeAttribute("data-active-header-theme");
    };
  }, []);

  return surface;
}

function LanguageSwitch({ adaptive = false }: { adaptive?: boolean }) {
  const { i18n, t } = useTranslation();
  const isArabic = i18n.language === "ar";
  const next = isArabic ? "en" : "ar";
  return (
    <button
      onClick={() => i18n.changeLanguage(next)}
      className={cn(
        "touch-target inline-flex items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-mono font-medium smooth",
        adaptive ? "header-control header-control-muted" : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={t("common.switchLanguage")}
      lang={isArabic ? "en" : "ar"}
      dir={isArabic ? "ltr" : "rtl"}
    >
      <Globe className="h-3.5 w-3.5" />
      <span>{isArabic ? "English" : "العربية"}</span>
    </button>
  );
}

function CurrencySwitch({ adaptive = false }: { adaptive?: boolean }) {
  const { t } = useTranslation();
  const currency = useCurrency((s) => s.currency);
  const toggle = useCurrency((s) => s.toggle);
  const next = currency === "IQD" ? "USD" : "IQD";

  return (
    <button
      onClick={toggle}
      className={cn(
        "touch-target inline-flex items-center justify-center rounded-full px-2 text-[11px] font-mono font-medium uppercase tracking-widest smooth",
        adaptive ? "header-control header-control-muted" : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={t("common.switchCurrency")}
      title={`${t("common.switchCurrency")}: ${next}`}
    >
      {next}
    </button>
  );
}

function AccountMenu() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const [open, setOpen] = useState(false);

  if (!user) {
    return (
      <button
        onMouseEnter={() => prefetchRoute("/login")}
        onFocus={() => prefetchRoute("/login")}
        onClick={() => navigate("/login")}
        className="header-icon-button header-control-muted touch-target hidden items-center justify-center rounded-full smooth press md:inline-flex"
        aria-label={t("common.account")}
      >
        <User className="h-[17px] w-[17px]" />
      </button>
    );
  }

  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  const links = [
    { to: "/account", label: t("accountMenu.overview"), icon: LayoutDashboard },
    { to: "/account/orders", label: t("accountMenu.orders"), icon: Package },
    { to: "/account/addresses", label: t("accountMenu.addresses"), icon: MapPin },
    { to: "/account/profile", label: t("accountMenu.profile"), icon: User },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="header-account-button hidden touch-target items-center justify-center rounded-full smooth md:inline-flex"
          aria-label={t("common.account")}
        >
          <span className="font-display text-[10px] font-bold text-primary">{initials}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="header-dropdown-panel w-64 p-0"
      >
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-sm font-medium truncate">{user.fullName}</p>
          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
        </div>
        <ul className="py-1">
          {links.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                {...createRoutePrefetchHandlers(to)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-high smooth"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            </li>
          ))}
          {user.role === "admin" && (
            <li>
              <Link
                to="/admin"
                {...createRoutePrefetchHandlers("/admin")}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-primary hover:bg-surface-high smooth"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                {t("accountMenu.adminDashboard")}
              </Link>
            </li>
          )}
        </ul>
        <div className="border-t border-border/30 py-1">
          <button
            onClick={() => {
              signOut();
              setOpen(false);
              prefetchRoute("/");
              navigate("/");
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-high smooth"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("accountMenu.signOut")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PromoLine({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-center gap-3 whitespace-nowrap">
      {icon}
      <span className="text-[10px] font-mono font-medium uppercase tracking-[0.28em] text-foreground/90">
        {title}
      </span>
      <span className="h-1 w-1 rounded-full bg-primary/70" aria-hidden />
      <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-muted-foreground">
        {detail}
      </span>
    </div>
  );
}

export function Header() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const count = useCart((s) => s.count());
  const openCart = useCart((s) => s.open);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
  const headerSurface = useAdaptiveHeaderSurface();
  const legacyHeaderTheme = headerSurface === "light" ? "light" : "dark";

  const links: NavItem[] = useMemo(() => buildNav(t), [t]);
  const promoItems = [
    { icon: <Truck className="h-3.5 w-3.5 text-primary" />, title: t("promo.shipping.title"), detail: t("promo.shipping.detail") },
    { icon: <ShieldCheck className="h-3.5 w-3.5 text-primary" />, title: t("promo.authentic.title"), detail: t("promo.authentic.detail") },
    { icon: <Headphones className="h-3.5 w-3.5 text-primary" />, title: t("promo.audition.title"), detail: t("promo.audition.detail") },
    { icon: <Sparkles className="h-3.5 w-3.5 text-primary" />, title: t("promo.preowned.title"), detail: t("promo.preowned.detail") },
  ];

  return (
    <>
      {/* Premium promo strip — rotating announcements */}
      <div
        className="fixed inset-x-0 top-0 z-40"
      >
        <div className="relative overflow-hidden bg-surface-lowest/95">
          {/* Ambient signal glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-55"
            style={{
              background:
                "radial-gradient(ellipse 60% 100% at 50% 50%, hsl(var(--primary) / 0.1), transparent 70%)",
            }}
            aria-hidden
          />
          {/* Slow shimmer sweep */}
          <div className="pointer-events-none absolute inset-y-0 -inset-x-1/2 promo-shimmer opacity-55" aria-hidden />
          {/* Top + bottom hairlines */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.5) 50%, transparent 100%)",
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, hsl(var(--border)) 50%, transparent 100%)",
            }}
            aria-hidden
          />

          <div className="container-edio relative flex h-9 items-center justify-center gap-6">
            {/* Center rotating messages */}
            <div className="flex justify-center overflow-hidden h-9">
              <div className="promo-rotator flex flex-col items-center">
                {promoItems.map((item, index) => (
                  <PromoLine key={`${item.title}-${index}`} icon={item.icon} title={item.title} detail={item.detail} />
                ))}
                <PromoLine icon={promoItems[0].icon} title={promoItems[0].title} detail={promoItems[0].detail} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <header
        data-header-surface={headerSurface}
        data-header-theme={legacyHeaderTheme}
        className="site-header signal-motion fixed inset-x-0 top-11 z-50 transition-transform duration-700"
      >
        <div
          className="site-header-core signal-motion mx-auto flex h-16 w-[calc(100%_-_1.5rem)] max-w-[1380px] items-center justify-between border px-3 transition-transform duration-700 md:h-[4.35rem] md:px-5"
        >
          <div className="flex items-center gap-3 md:gap-10">
            <button
              className="header-icon-button touch-target group relative inline-flex items-center justify-center rounded-full press md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label={t("common.openMenu")}
              aria-expanded={mobileOpen}
            >
              <span className="signal-motion absolute h-px w-5 -translate-y-1.5 bg-current transition-transform duration-500 group-hover:w-6" />
              <span className="signal-motion absolute h-px w-5 translate-y-1.5 bg-current transition-transform duration-500 group-hover:w-6" />
            </button>
            <Logo />
          </div>

          <nav className="site-header-nav-pill hidden items-center gap-1 rounded-full border px-1 md:flex">
            {links.map((l) => (
              <DesktopNavItem key={l.to} item={l} />
            ))}
          </nav>

          <div className="flex items-center gap-3 md:gap-5">
            <LanguageSwitch adaptive />
            <CurrencySwitch adaptive />
            <span className="header-divider hidden h-4 w-px md:block" />
            <button
              onMouseEnter={() => prefetchRoute("/shop")}
              onFocus={() => prefetchRoute("/shop")}
              onClick={() => navigate("/shop")}
              className="header-icon-button header-control-muted touch-target inline-flex items-center justify-center rounded-full smooth press"
              aria-label={t("common.search")}
            >
              <Search className="h-[17px] w-[17px]" />
            </button>
            <AccountMenu />
            <button
              onClick={openCart}
              className="header-icon-button touch-target relative inline-flex items-center justify-center rounded-full smooth press"
              aria-label={t("common.cart")}
            >
              <ShoppingBag className="h-[17px] w-[17px]" />
              {count > 0 && (
                <span className="absolute -top-2 -end-2 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-mono font-semibold text-primary-foreground animate-in zoom-in-50 duration-300">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Hairline glow under header when scrolled */}
        <div className="site-header-glow pointer-events-none absolute inset-x-12 -bottom-px h-px" aria-hidden />
      </header>



      {/* Mobile fullscreen menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-background/94 backdrop-blur-2xl animate-in fade-in duration-500">
          <div className="container-edio flex h-16 items-center justify-between md:h-20">
            <Logo />
            <button onClick={() => setMobileOpen(false)} aria-label={t("common.closeMenu")} className="touch-target group relative inline-flex items-center justify-center press">
              <X className="h-5 w-5 opacity-0" aria-hidden />
              <span className="signal-motion absolute h-px w-6 rotate-45 bg-current transition-transform duration-500 group-hover:scale-x-110" />
              <span className="signal-motion absolute h-px w-6 -rotate-45 bg-current transition-transform duration-500 group-hover:scale-x-110" />
            </button>
          </div>
          <div
            className="container-edio mt-8 flex flex-col gap-1 overflow-y-auto pb-12"
            style={{ maxHeight: "calc(100vh - 6rem)" }}
          >
            {links.map((l, idx) => {
              const hasChildren = !!l.groups?.length;
              const isOpen = openMobileGroup === l.to;
              return (
                <div
                  key={l.to}
                  className="border-b border-border/20 animate-in fade-in slide-in-from-bottom-4 duration-700"
                  style={{ animationDelay: `${idx * 55}ms`, animationFillMode: "backwards" }}
                >
                  <div className="flex items-center justify-between py-3">
                    <Link
                      to={l.to}
                      {...createRoutePrefetchHandlers(l.to)}
                      onClick={() => setMobileOpen(false)}
                    className="flex min-h-12 items-center font-display text-2xl font-bold tracking-tight transition-transform duration-500 hover:translate-x-1 rtl:hover:-translate-x-1"
                    >
                      {l.label}
                    </Link>
                    {hasChildren && (
                      <button
                        onClick={() => setOpenMobileGroup(isOpen ? null : l.to)}
                        className="touch-target inline-flex items-center justify-center text-muted-foreground"
                        aria-label={t("common.toggleSubmenu")}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {hasChildren && isOpen && (
                    <div className="pb-4 ps-2 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                      {l.groups!.map((g) => (
                        <div key={g.label}>
                          <Link
                            to={g.to ?? l.to}
                            {...createRoutePrefetchHandlers(g.to ?? l.to)}
                            onClick={() => setMobileOpen(false)}
                            className="inline-flex min-h-11 items-center label-tech text-primary"
                          >
                            {g.label}
                          </Link>
                          {g.children && (
                            <ul className="mt-2 space-y-2 ps-3">
                              {g.children.map((c) => (
                                <li key={c.to}>
                                  <Link
                                    to={c.to}
                                    {...createRoutePrefetchHandlers(c.to)}
                                    onClick={() => setMobileOpen(false)}
                                    className="flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground smooth"
                                  >
                                    {c.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mt-10 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    prefetchRoute("/shop");
                    navigate("/shop");
                  }}
                    className="premium-ghost flex flex-col items-center gap-2 px-3 py-4 text-muted-foreground"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    {t("common.search")}
                  </span>
                </button>
                <Link
                  to={useAuth.getState().user ? "/account" : "/login"}
                  {...createRoutePrefetchHandlers(useAuth.getState().user ? "/account" : "/login")}
                  onClick={() => setMobileOpen(false)}
                  className="premium-ghost flex flex-col items-center gap-2 px-3 py-4 text-muted-foreground"
                >
                  <User className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    {t("common.account")}
                  </span>
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    openCart();
                  }}
                  className="premium-ghost relative flex flex-col items-center gap-2 px-3 py-4 text-muted-foreground"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    {t("common.cart")}
                  </span>
                  {count > 0 && (
                    <span className="absolute top-2 end-2 inline-flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-mono font-semibold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-border/20 pt-5">
                <div className="flex items-center gap-3">
                  <LanguageSwitch />
                  <CurrencySwitch />
                </div>
                <a
                  href="https://t.me/edio_iq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground smooth hover:text-foreground"
                >
                  Telegram · @edio_iq
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopNavItem({ item }: { item: NavItem }) {
  const hasDropdown = !!item.groups?.length;

  return (
    <div className="relative group">
      <NavLink
        to={item.to}
        {...createRoutePrefetchHandlers(item.to)}
        className={({ isActive }) =>
          cn(
            "header-nav-link relative inline-flex items-center gap-1 rounded-full px-3 py-3 text-[11px] font-semibold uppercase tracking-widest smooth",
            isActive && "header-nav-link--active",
          )
        }
      >
        {({ isActive }) => (
          <>
            {item.label}
            {hasDropdown && (
              <ChevronDown className="h-3 w-3 opacity-50 transition-transform duration-300 group-hover:rotate-180 group-hover:opacity-100" />
            )}
            {/* Underline indicator */}
            <span
              className={cn(
                "absolute inset-x-3 bottom-1.5 h-px bg-primary origin-center scale-x-0 transition-transform duration-500 ease-out",
                isActive ? "scale-x-100" : "group-hover:scale-x-100",
              )}
              aria-hidden
            />
          </>
        )}
      </NavLink>

      {hasDropdown && (
        <div
          className={cn(
            "absolute start-1/2 -translate-x-1/2 top-full pt-1",
            "opacity-0 invisible translate-y-2 transition-all duration-300 ease-out",
            "group-hover:opacity-100 group-hover:visible group-hover:translate-y-0",
          )}
        >
          <div className="header-dropdown-panel premium-shell min-w-[280px]">
          <div className="premium-core p-1.5">
            {item.groups!.map((g) => (
              <div key={g.label} className="relative group/sub">
                <Link
                  to={g.to ?? item.to}
                  {...createRoutePrefetchHandlers(g.to ?? item.to)}
                  className="flex items-center justify-between gap-4 rounded-sm px-4 py-2.5 text-sm text-foreground/85 hover:bg-surface-high hover:text-primary smooth"
                >
                  <span>{g.label}</span>
                  {g.children && (
                    <ChevronRight className="h-3 w-3 opacity-50 rtl:rotate-180 transition-transform group-hover/sub:translate-x-0.5 rtl:group-hover/sub:-translate-x-0.5" />
                  )}
                </Link>
                {g.children && (
                  <div
                    className={cn(
                      "absolute top-0 start-full ps-2",
                      "opacity-0 invisible -translate-x-1 transition-all duration-300 ease-out",
                      "group-hover/sub:opacity-100 group-hover/sub:visible group-hover/sub:translate-x-0",
                    )}
                  >
                    <div className="header-dropdown-panel premium-shell min-w-[230px]">
                    <div className="premium-core p-1.5">
                      {g.children.map((c) => (
                        <Link
                          key={c.to}
                          to={c.to}
                          {...createRoutePrefetchHandlers(c.to)}
                          className="block rounded-sm px-4 py-2.5 text-sm text-muted-foreground hover:bg-surface-high hover:text-primary smooth"
                        >
                          {c.label}
                        </Link>
                      ))}
                    </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

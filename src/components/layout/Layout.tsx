import { Suspense, lazy, useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useDirection } from "@/i18n/useDirection";
import { useReveal } from "@/hooks/useReveal";
import { useCart } from "@/store/cart";

const CartDrawer = lazy(() => import("@/components/layout/CartDrawer").then((module) => ({ default: module.CartDrawer })));

export function Layout({ children }: { children: React.ReactNode }) {
  const { dir, lang } = useDirection();
  const isCartOpen = useCart((s) => s.isOpen);
  const [shouldMountCart, setShouldMountCart] = useState(false);
  useReveal();

  useEffect(() => {
    if (isCartOpen) setShouldMountCart(true);
  }, [isCartOpen]);

  return (
    <div dir={dir} lang={lang} className="min-h-screen flex flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed start-4 top-4 z-[120] -translate-y-24 bg-primary px-4 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      {shouldMountCart ? (
        <Suspense fallback={null}>
          <CartDrawer />
        </Suspense>
      ) : null}
    </div>
  );
}

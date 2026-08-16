// Design reminder: Quiet Maroon Hospitality — use a service-counter flow with a concise header and thumb-friendly navigation.
import { BrandMark } from "@/components/BrandMark";
import { StatusRibbon } from "@/components/StatusRibbon";
import { Button } from "@/components/ui/button";
import { useOrdering } from "@/contexts/OrderingContext";
import { cn } from "@/lib/utils";
import { Clock3, Menu, ShoppingBag, UserRound, UtensilsCrossed } from "lucide-react";
import { Link, useLocation } from "wouter";
import type { ReactNode } from "react";

const primaryLinks = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/restaurant", label: "Restaurant" },
];

const mobileLinks = [
  { href: "/", label: "Home", icon: UtensilsCrossed },
  { href: "/menu", label: "Menu", icon: Menu },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/track", label: "Track", icon: Clock3 },
  { href: "/account", label: "Account", icon: UserRound },
];

export function OrderingShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { cartCount } = useOrdering();

  return (
    <div className="min-h-screen bg-[#fbf7f0] pb-20 text-[#3a2924] lg:pb-0">
      <StatusRibbon />
      <header className="sticky top-0 z-40 border-b border-[#e6ddd1] bg-[#fbf7f0]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link aria-label="THE HAROLD'S PLACE home" href="/">
            <BrandMark />
          </Link>

          <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
            {primaryLinks.map((link) => (
              <Link
                className={cn(
                  "text-sm font-bold transition-colors hover:text-[#6f2028]",
                  location === link.href ? "text-[#6f2028]" : "text-[#6c5d54]",
                )}
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Link href="/cart">
            <Button className="h-10 rounded-sm bg-[#6f2028] px-4 text-sm font-extrabold shadow-none hover:bg-[#541820]">
              <ShoppingBag aria-hidden="true" className="mr-2 size-4" />
              Basket
              <span aria-label={`${cartCount} basket items`} className="ml-2 inline-flex min-w-5 justify-center rounded-sm bg-[#f7eee0] px-1.5 py-0.5 text-[0.65rem] font-black text-[#6f2028]">
                {cartCount}
              </span>
            </Button>
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <footer className="border-t border-[#e6ddd1] bg-[#f4ecdf] px-4 py-9 sm:px-6 lg:mt-10">
        <div className="mx-auto grid max-w-7xl gap-7 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <BrandMark className="mb-3" />
            <p className="max-w-md text-sm leading-6 text-[#6c5d54]">
              A mobile-first ordering experience under configuration for THE HAROLD&apos;S PLACE. Restaurant details shown here remain subject to owner confirmation.
            </p>
          </div>
          <div>
            <p className="receipt-label">Ordering</p>
            <div className="mt-3 grid gap-2 text-sm font-bold text-[#5a453a]">
              <Link href="/menu">Browse menu</Link>
              <Link href="/track">Track an order</Link>
              <Link href="/cart">Review basket</Link>
            </div>
          </div>
          <div>
            <p className="receipt-label">Restaurant</p>
            <div className="mt-3 grid gap-2 text-sm font-bold text-[#5a453a]">
              <Link href="/restaurant">Information & sources</Link>
              <a href="https://www.instagram.com/haroldsplace__ng/" rel="noreferrer" target="_blank">Instagram profile</a>
              <a href="https://www.facebook.com/haroldsplace.ng/" rel="noreferrer" target="_blank">Facebook page</a>
            </div>
          </div>
        </div>
      </footer>

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-[#e6ddd1] bg-[#fffaf3] px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_24px_rgba(76,57,48,0.08)] lg:hidden">
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const active = location === link.href;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-sm text-[0.64rem] font-extrabold transition-colors",
                active ? "text-[#6f2028]" : "text-[#7e6e63]",
              )}
              href={link.href}
              key={link.href}
            >
              <Icon aria-hidden="true" className="size-[1.15rem]" strokeWidth={active ? 2.5 : 2} />
              {link.label}
              {link.href === "/cart" && cartCount > 0 ? <span className="absolute right-[27%] top-1 size-2 rounded-full bg-[#6f2028]" /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

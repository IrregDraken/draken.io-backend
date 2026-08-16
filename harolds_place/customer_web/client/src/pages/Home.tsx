// Design reminder: Quiet Maroon Hospitality — a service-counter home page, high-key identity art, and no unverified food claims.
import { ConfigurationNotice } from "@/components/ConfigurationNotice";
import { OrderingShell } from "@/components/OrderingShell";
import { Button } from "@/components/ui/button";
import { restaurant } from "@/lib/restaurant";
import { ArrowRight, CheckCircle2, MapPin, PackageSearch, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const heroArtUrl = "/manus-storage/harolds-place-hero-arch_36fc5220.png";

export default function Home() {
  return (
    <OrderingShell>
      <section className="overflow-hidden border-b border-[#e6ddd1] bg-[#fbf7f0]">
        <div className="mx-auto grid max-w-7xl items-stretch lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative px-4 pb-11 pt-11 sm:px-6 sm:pb-16 sm:pt-16 lg:py-24 lg:pr-14">
            <div className="hero-rule" />
            <p className="receipt-label text-[#8a4b50]">THE HAROLD&apos;S PLACE · ORDERING</p>
            <h1 className="mt-4 max-w-xl font-display text-[2.75rem] leading-[0.95] tracking-[-0.045em] text-[#3a2924] sm:text-6xl lg:text-7xl">
              A clearer way to place your order.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[#69584d] sm:text-lg">
              The restaurant&apos;s digital ordering desk is being set up with confirmed menu and service details before it opens for orders.
            </p>
            <dl className="hero-service-ledger mt-7 max-w-lg" aria-label="Current ordering service status">
              <div><dt>Menu</dt><dd>Awaiting publication</dd></div>
              <div><dt>Fulfilment</dt><dd>Awaiting confirmation</dd></div>
              <div><dt>Payment</dt><dd>Not activated</dd></div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/menu">
                <Button className="h-12 rounded-sm bg-[#6f2028] px-5 text-sm font-extrabold shadow-none hover:bg-[#541820]">
                  View menu status <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                </Button>
              </Link>
              <Link href="/restaurant">
                <Button className="h-12 rounded-sm border border-[#bdaea0] bg-transparent px-5 text-sm font-extrabold text-[#4c3930] shadow-none hover:bg-[#f2e9dc]">
                  Restaurant information
                </Button>
              </Link>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs font-bold text-[#7a685c]">
              <ShieldCheck aria-hidden="true" className="size-4 text-[#6f2028]" />
              No menu items, prices, delivery fees, or hours are shown until confirmed by the restaurant.
            </p>
          </div>

          <div className="relative min-h-[300px] border-t border-[#e6ddd1] bg-[#f0e5d7] lg:min-h-full lg:border-l lg:border-t-0">
            <img alt="Temporary arched hospitality visual for THE HAROLD'S PLACE ordering" className="absolute inset-0 size-full object-cover" src={heroArtUrl} />
            <div className="absolute inset-x-4 bottom-4 max-w-sm border border-[#f5e8d7]/80 bg-[#3a2924]/93 p-4 text-[#fffaf3] shadow-[0_18px_44px_rgba(58,41,36,0.2)] sm:inset-x-auto sm:left-8 sm:bottom-8">
              <p className="receipt-label text-[#e5c8ab]">Current place</p>
              <p className="mt-2 font-display text-2xl leading-tight">{restaurant.location}</p>
              <p className="mt-2 text-xs leading-5 text-[#f3e4d2]">Public location information is being checked with the restaurant before launch.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:py-16">
        <ConfigurationNotice />
        <aside className="border-l-2 border-[#6f2028] bg-[#f4ecdf] p-6 sm:p-8">
          <p className="receipt-label text-[#8a4b50]">What this ordering desk will cover</p>
          <ul className="mt-5 grid gap-4">
            {[
              "Live menu and availability from restaurant staff",
              "Pickup or delivery only when enabled by the restaurant",
              "Order confirmation and status updates through the same system",
            ].map((item) => (
              <li className="flex gap-3 text-sm font-bold leading-6 text-[#4c3930]" key={item}>
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#6f2028]" />
                {item}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="border-y border-[#e6ddd1] bg-[#fffaf3]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="service-point">
            <MapPin aria-hidden="true" className="size-5 text-[#6f2028]" />
            <p className="receipt-label">Location</p>
            <p>{restaurant.location}</p>
            <span>Address confirmation pending</span>
          </div>
          <div className="service-point">
            <PackageSearch aria-hidden="true" className="size-5 text-[#6f2028]" />
            <p className="receipt-label">Menu</p>
            <p>Not yet published</p>
            <span>Food, prices, and options remain unlisted</span>
          </div>
          <div className="service-point">
            <ShieldCheck aria-hidden="true" className="size-5 text-[#6f2028]" />
            <p className="receipt-label">Service status</p>
            <p>{restaurant.status}</p>
            <span>Pickup, delivery, and payments await setup</span>
          </div>
        </div>
      </section>
    </OrderingShell>
  );
}

// Design reminder: Quiet Maroon Hospitality — menu structure should remain useful and honest when no verified menu exists.
import { ConfigurationNotice } from "@/components/ConfigurationNotice";
import { OrderingShell } from "@/components/OrderingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrdering } from "@/contexts/OrderingContext";
import { formatNaira, orderingApi, type MenuResponse } from "@/lib/api";
import { restaurant } from "@/lib/restaurant";
import { Info, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Menu() {
  const { addLine } = useOrdering();
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    orderingApi.menu().then((response) => active && setMenu(response)).catch(() => active && setMenu(null)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const publishedItems = (menu?.items || []).filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <OrderingShell>
      <section className="mx-auto max-w-7xl px-4 py-9 sm:px-6 lg:py-12">
        <div className="grid gap-4 border-b border-[#e6ddd1] pb-7 sm:flex sm:items-end sm:justify-between">
          <div>
            <p className="receipt-label text-[#8a4b50]">Menu desk</p>
            <h1 className="mt-2 font-display text-5xl tracking-[-0.04em] text-[#3a2924]">What&apos;s on the table</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#69584d]">Menu search, categories, availability, and item customisation will appear here as soon as staff publishes approved data.</p>
          </div>
          <p className="inline-flex w-fit items-center gap-2 border border-[#dfcfc0] bg-[#f4ecdf] px-3 py-2 text-xs font-extrabold text-[#6b5144]">
            <Info aria-hidden="true" className="size-3.5 text-[#6f2028]" />
            {restaurant.status}
          </p>
        </div>

        <div className="mt-7 flex gap-2 overflow-x-auto pb-1" aria-label="Menu categories">
          <span className="category-tab category-tab--active">All items</span>
          {(menu?.categories || []).map((category) => <span className="category-tab" key={category.id}>{category.name}</span>)}
          {(!menu || menu.categories.length === 0) ? <span className="category-tab">Categories await setup</span> : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">Search food once the menu is available</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#8c776b]" />
            <Input aria-describedby="menu-search-note" className="h-12 rounded-sm border-[#d8cabb] bg-[#fffaf3] pl-11 text-sm shadow-none focus-visible:ring-[#6f2028]" disabled={!menu?.isConfigured} onChange={(event) => setSearch(event.target.value)} placeholder={menu?.isConfigured ? "Search menu" : "Search will activate when the menu is published"} value={search} />
          </label>
          <Button className="h-12 rounded-sm border border-[#bdaea0] bg-transparent px-4 text-sm font-extrabold text-[#4c3930] shadow-none hover:bg-[#f2e9dc]" disabled variant="outline">
            <SlidersHorizontal aria-hidden="true" className="mr-2 size-4" /> Filter
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#806f64]" id="menu-search-note">{menu?.isConfigured ? "Menu items are supplied by the ordering service." : "Search and filter are intentionally unavailable until restaurant data is configured."}</p>

        {loading ? <div className="mt-8 grid gap-3"><div className="h-28 animate-pulse bg-[#f0e5d7]" /><div className="h-28 animate-pulse bg-[#f0e5d7]" /></div> : null}
        {!loading && (!menu?.isConfigured || publishedItems.length === 0) ? <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(250px,0.65fr)]"><ConfigurationNotice compact /><aside className="menu-service-stub"><p className="receipt-label text-[#8a4b50]">Service counter</p><dl className="mt-3 grid gap-3"><div><dt>Menu release</dt><dd>Pending staff entry</dd></div><div><dt>Availability</dt><dd>Live when published</dd></div><div><dt>Basket</dt><dd>Ready for confirmed items</dd></div></dl></aside></div> : null}
        {!loading && (!menu?.isConfigured || publishedItems.length === 0) ? <section className="menu-ledger-skeleton mt-5" aria-label="Future menu structure"><div className="menu-ledger-heading"><span>Menu list will appear here</span><span>Price</span></div>{["Approved menu item", "Available options", "Restaurant notes"].map((label, index) => <div className="menu-ledger-row" key={label}><span className="ledger-index">0{index + 1}</span><div><strong>{label}</strong><small>{index === 0 ? "Name, description, and availability" : index === 1 ? "Extras and preparation details" : "Service information for each item"}</small></div><span className="ledger-price">—</span></div>)}</section> : null}
        {publishedItems.length > 0 ? <section className="mt-8 grid gap-3 md:grid-cols-2">{publishedItems.map((item) => <article className="border border-[#e2d5c8] bg-[#fffaf3] p-5" key={item.id}><p className="receipt-label text-[#8a4b50]">{menu?.categories.find((category) => category.id === item.categoryId)?.name || "Menu item"}</p><h2 className="mt-2 font-display text-3xl text-[#3a2924]">{item.name}</h2>{item.description ? <p className="mt-2 text-sm leading-6 text-[#69584d]">{item.description}</p> : null}<div className="mt-5 flex items-center justify-between gap-3"><span className="font-bold text-[#3a2924]">{formatNaira(item.priceKobo)}</span><Button className="rounded-sm bg-[#6f2028] text-sm font-extrabold shadow-none hover:bg-[#541820]" onClick={() => { addLine({ id: item.id, name: item.name, quantity: 1, unitPriceKobo: item.priceKobo, options: [] }); toast.success(`${item.name} added to basket.`); }}><Plus aria-hidden="true" className="mr-1.5 size-4" />Add</Button></div></article>)}</section> : null}
      </section>
      <section className="border-t border-[#e6ddd1] bg-[#f4ecdf]">
        <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6">
          <p className="receipt-label text-[#8a4b50]">Need restaurant information?</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#69584d]">Public social profiles are available, but this ordering menu will use only details confirmed and entered by the restaurant team.</p>
          <Link href="/restaurant"><Button className="mt-5 rounded-sm bg-[#6f2028] text-sm font-extrabold shadow-none hover:bg-[#541820]">View restaurant information</Button></Link>
        </div>
      </section>
    </OrderingShell>
  );
}

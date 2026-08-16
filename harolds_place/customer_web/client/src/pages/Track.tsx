// Design reminder: Quiet Maroon Hospitality — order tracking is a clear operational timeline, never decorative pseudo-realtime.
import { OrderingShell } from "@/components/OrderingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orderSteps } from "@/lib/restaurant";
import { SearchCheck, Signal } from "lucide-react";
import { toast } from "sonner";

export default function Track() {
  return (
    <OrderingShell>
      <section className="mx-auto max-w-5xl px-4 py-9 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="receipt-label text-[#8a4b50]">Order tracking</p>
            <h1 className="mt-2 font-display text-5xl tracking-[-0.04em] text-[#3a2924]">Follow the handoff.</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#69584d]">Once live orders are accepted, customers can use their order number to see only the status steps relevant to their pickup or delivery.</p>
            <div className="mt-7 border border-[#e2d5c8] bg-[#fffaf3] p-5">
              <label className="receipt-label" htmlFor="order-reference">Order number</label>
              <Input className="mt-2 h-12 rounded-sm border-[#d8cabb] bg-[#fffaf3] shadow-none focus-visible:ring-[#6f2028]" id="order-reference" placeholder="e.g. HP-000123" />
              <Button className="mt-3 h-11 w-full rounded-sm bg-[#6f2028] text-sm font-extrabold shadow-none hover:bg-[#541820]" onClick={() => toast.info("Order lookup will activate after the secure ordering API is deployed and connected.")}>
                <SearchCheck aria-hidden="true" className="mr-2 size-4" /> Find order
              </Button>
            </div>
          </div>
          <div className="relative border-l-2 border-[#dfcfc0] pl-7 pt-1 sm:pl-9">
            <p className="inline-flex items-center gap-2 text-xs font-extrabold text-[#7a685c]"><Signal aria-hidden="true" className="size-4 text-[#6f2028]" /> Status progression</p>
            <ol className="mt-7 grid gap-0">
              {orderSteps.map((step, index) => (
                <li className="timeline-step" key={step}>
                  <span className="timeline-number">{index + 1}</span>
                  <div>
                    <p className="font-display text-2xl text-[#3a2924]">{step}</p>
                    <p className="mt-1 text-sm leading-6 text-[#69584d]">{index === 0 ? "Created after a valid order is submitted." : "Shown when restaurant staff records the next valid handoff."}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </OrderingShell>
  );
}

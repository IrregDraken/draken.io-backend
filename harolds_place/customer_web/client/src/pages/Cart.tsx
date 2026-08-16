// Design reminder: Quiet Maroon Hospitality — cart is a readable receipt, with a candid empty state instead of simulated basket contents.
import { OrderingShell } from "@/components/OrderingShell";
import { Button } from "@/components/ui/button";
import { useOrdering } from "@/contexts/OrderingContext";
import { formatNaira } from "@/lib/api";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "wouter";

export default function Cart() {
  const { cart, cartCount, cartSubtotalKobo, removeLine, updateQuantity } = useOrdering();
  return (
    <OrderingShell>
      <section className="mx-auto max-w-5xl px-4 py-9 sm:px-6 lg:py-12">
        <p className="receipt-label text-[#8a4b50]">Your order</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.04em] text-[#3a2924]">Basket</h1>
        <div className="mt-8 grid gap-7 lg:grid-cols-[1fr_280px]">
          <div className="border border-[#e2d5c8] bg-[#fffaf3] p-6 sm:p-8">
            {cartCount === 0 ? (
              <div className="py-7 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-sm bg-[#f4ecdf] text-[#6f2028]"><ShoppingBag aria-hidden="true" className="size-6" /></span>
                <h2 className="mt-5 font-display text-3xl text-[#3a2924]">Your basket is ready.</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#69584d]">There are no items to review because the restaurant has not published its confirmed menu yet.</p>
                <Link href="/menu"><Button className="mt-6 rounded-sm bg-[#6f2028] text-sm font-extrabold shadow-none hover:bg-[#541820]">Check menu status <ArrowRight aria-hidden="true" className="ml-2 size-4" /></Button></Link>
              </div>
            ) : <div className="grid divide-y divide-[#eadfd4]">{cart.map((line) => <article className="grid gap-4 py-4 first:pt-0 sm:grid-cols-[1fr_auto]" key={line.id}><div><h2 className="font-display text-2xl text-[#3a2924]">{line.name}</h2>{line.options.length > 0 ? <p className="mt-1 text-sm text-[#69584d]">{line.options.join(", ")}</p> : null}<p className="mt-1 text-sm font-bold text-[#6f2028]">{formatNaira(line.unitPriceKobo)} each</p></div><div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end"><span className="font-bold text-[#3a2924]">{formatNaira(line.unitPriceKobo * line.quantity)}</span><div className="flex items-center gap-1 border border-[#d8cabb] bg-[#fffaf3]"><Button aria-label={`Decrease ${line.name} quantity`} className="size-8 rounded-none bg-transparent p-0 text-[#6f2028] shadow-none hover:bg-[#f4ecdf]" onClick={() => updateQuantity(line.id, line.quantity - 1)}><Minus className="size-3.5" /></Button><span className="grid min-w-8 place-items-center text-sm font-extrabold">{line.quantity}</span><Button aria-label={`Increase ${line.name} quantity`} className="size-8 rounded-none bg-transparent p-0 text-[#6f2028] shadow-none hover:bg-[#f4ecdf]" onClick={() => updateQuantity(line.id, line.quantity + 1)}><Plus className="size-3.5" /></Button><Button aria-label={`Remove ${line.name}`} className="ml-1 size-8 rounded-none border-l border-[#d8cabb] bg-transparent p-0 text-[#8a4b50] shadow-none hover:bg-[#f4ecdf]" onClick={() => removeLine(line.id)}><Trash2 className="size-3.5" /></Button></div></div></article>)}</div>}
          </div>
          <aside className="h-fit border-t-2 border-[#6f2028] bg-[#f4ecdf] p-5">
            <p className="receipt-label text-[#8a4b50]">Order receipt</p>
            <dl className="mt-5 grid gap-3 text-sm">
              <div className="receipt-row"><dt>Items</dt><dd>{cartCount}</dd></div>
              <div className="receipt-row"><dt>Subtotal</dt><dd>{cartCount > 0 ? formatNaira(cartSubtotalKobo) : "—"}</dd></div>
              <div className="receipt-row"><dt>Delivery</dt><dd>Not configured</dd></div>
              <div className="receipt-row receipt-row--total"><dt>Total</dt><dd>{cartCount > 0 ? formatNaira(cartSubtotalKobo) : "—"}</dd></div>
            </dl>
            {cartCount > 0 ? <Link href="/checkout"><Button className="mt-6 h-12 w-full rounded-sm bg-[#6f2028] text-sm font-extrabold shadow-none hover:bg-[#541820]">Continue to checkout</Button></Link> : <Button className="mt-6 h-12 w-full rounded-sm bg-[#6f2028] text-sm font-extrabold shadow-none" disabled>Checkout activates with an item</Button>}
          </aside>
        </div>
      </section>
    </OrderingShell>
  );
}

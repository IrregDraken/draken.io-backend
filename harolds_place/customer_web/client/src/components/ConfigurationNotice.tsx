// Design reminder: Quiet Maroon Hospitality — configuration states are candid service guidance, not fake menu content.
import { configurationSteps } from "@/lib/restaurant";
import { ClipboardList, Dot } from "lucide-react";

export function ConfigurationNotice({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "config-notice config-notice--compact" : "config-notice"} aria-label="Ordering configuration status">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm bg-[#6f2028] text-[#fffaf3]">
          <ClipboardList aria-hidden="true" className="size-4" />
        </span>
        <div>
          <p className="receipt-label text-[#8a4b50]">Restaurant configuration</p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-[#3a2924]">The first ordering details are being prepared.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#69584d]">
            To protect customers from inaccurate food information, ordering stays unavailable until the restaurant has confirmed its menu and service settings.
          </p>
        </div>
      </div>
      {!compact ? (
        <ol className="mt-5 grid gap-2 border-t border-[#ddcdbb] pt-4 sm:grid-cols-3">
          {configurationSteps.map((step, index) => (
            <li className="flex items-start gap-1.5 text-xs font-bold leading-5 text-[#5a453a]" key={step}>
              <span className="mt-0.5 font-display text-base text-[#6f2028]">0{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

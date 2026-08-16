// Design reminder: Quiet Maroon Hospitality — status language must be factual and use contrast, not decorative badges.
import { Settings2 } from "lucide-react";

export function StatusRibbon() {
  return (
    <div className="border-b border-[#e3d8ca] bg-[#f4ecdf] px-4 py-2 text-[#4c3930] sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-2 text-xs leading-5">
        <Settings2 aria-hidden="true" className="size-3.5 shrink-0 text-[#6f2028]" />
        <p>
          <strong className="font-extrabold">Ordering setup in progress.</strong> Menu, hours, pickup, delivery, and payment details will appear after the restaurant confirms them.
        </p>
      </div>
    </div>
  );
}

// Design reminder: Quiet Maroon Hospitality — the temporary arched mark must stay clear, sizeable, and replaceable.
import { cn } from "@/lib/utils";

const brandMarkUrl = "/manus-storage/harolds-place-temporary-mark_fea81fd1.png";

export function BrandMark({ className, labelled = true }: { className?: string; labelled?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <img
        alt="Temporary THE HAROLD'S PLACE monogram"
        className="size-11 shrink-0 object-contain"
        src={brandMarkUrl}
      />
      {labelled ? (
        <span className="min-w-0 leading-none">
          <strong className="block font-display text-[1.13rem] font-normal tracking-[-0.03em] text-[#3a2924]">
            THE HAROLD&apos;S PLACE
          </strong>
          <span className="mt-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-[#8c776b]">
            Ordering desk
          </span>
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

export type PrintPreviewStyle = {
  id: string;
  name: string;
  trimWidthIn: number;
  trimHeightIn: number;
};

type Props = {
  style: PrintPreviewStyle;
  coverSrc?: string | null;
  /** First story page illustration */
  spreadImageSrc?: string | null;
  /** First story page text (truncated in UI) */
  spreadText?: string | null;
  hasDedication?: boolean;
  className?: string;
};

function pickSrc(url?: string | null, data?: string | null): string | undefined {
  if (data?.startsWith("data:")) return data;
  if (url) return url;
  return undefined;
}

/**
 * Lightweight mockup: closed cover + one open spread using the family’s real artwork/text.
 */
export function PrintBookStylePreview({
  style,
  coverSrc,
  spreadImageSrc,
  spreadText,
  hasDedication,
  className,
}: Props) {
  const coverRatio = style.trimWidthIn / style.trimHeightIn;
  const spreadRatio = (2 * style.trimWidthIn) / style.trimHeightIn;

  const excerpt =
    spreadText && spreadText.length > 220
      ? `${spreadText.slice(0, 220)}…`
      : spreadText;

  return (
    <div className={cn("space-y-4", className)}>
      <p className="text-center text-xs font-medium text-muted-foreground">
        Preview — {style.name}
      </p>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:items-start">
        {/* Closed book (cover) */}
        <div className="flex flex-col items-center">
          <div
            className="relative w-36 overflow-hidden rounded-r-md border border-border bg-muted shadow-lg sm:w-40"
            style={{ aspectRatio: `${coverRatio}` }}
          >
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote user book assets
              <img
                src={coverSrc}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/60 p-2 text-center text-[10px] text-muted-foreground">
                Cover
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-full bg-black/15"
              aria-hidden
            />
          </div>
          <span className="mt-2 text-[10px] text-muted-foreground">Cover</span>
        </div>

        {/* Open spread */}
        <div className="flex max-w-full flex-col items-center">
          <div
            className="flex w-full max-w-md overflow-hidden rounded-md border border-border bg-[#f5f0e8] shadow-md dark:bg-[#2a2620]"
            style={{ aspectRatio: `${spreadRatio}` }}
          >
            <div className="flex flex-1 border-r border-black/10">
              {spreadImageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={spreadImageSrc}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-white/40 p-2 text-center text-[10px] text-muted-foreground dark:bg-black/20">
                  Illustration
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center bg-[#ffffff] p-2 sm:p-3">
              {hasDedication && (
                <p className="mb-1 text-[9px] italic text-muted-foreground">
                  Story preview (dedication not shown)
                </p>
              )}
              <p className="line-clamp-6 text-[10px] leading-snug text-foreground sm:text-xs sm:leading-relaxed">
                {excerpt || "Story text appears here in your printed book."}
              </p>
            </div>
          </div>
          <span className="mt-2 text-[10px] text-muted-foreground">
            Sample spread (first story page)
          </span>
        </div>
      </div>
    </div>
  );
}

export function bookToPreviewSources(book: {
  coverImageUrl?: string;
  coverImageData?: string;
  pages?: { imageUrl?: string; imageData?: string; text?: string }[];
  dedication?: { message?: string };
}) {
  const coverSrc = pickSrc(book.coverImageUrl, book.coverImageData);
  const p0 = book.pages?.[0];
  const spreadImageSrc = pickSrc(p0?.imageUrl, p0?.imageData);
  const spreadText = p0?.text ?? null;
  const hasDedication = Boolean(book.dedication?.message);
  return { coverSrc, spreadImageSrc, spreadText, hasDedication };
}

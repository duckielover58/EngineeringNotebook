"use client";

import { useState, type ReactNode } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type PhotoLightboxProps = {
  src: string;
  alt: string;
  children: ReactNode;
  className?: string;
};

export function PhotoLightbox({ src, alt, children, className }: PhotoLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={cn(
          "cursor-zoom-in border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
          className
        )}
        onClick={() => setOpen(true)}
        aria-label={alt ? `View full size: ${alt}` : "View full size image"}
      >
        {children}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95vh] w-[min(96vw,1200px)] max-w-none border-0 bg-black/90 p-2 shadow-2xl sm:rounded-lg [&>button]:text-white [&>button]:opacity-90 [&>button]:hover:opacity-100">
          <DialogTitle className="sr-only">{alt || "Image preview"}</DialogTitle>
          <div className="flex max-h-[85vh] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[85vh] w-auto max-w-full object-contain"
              draggable={false}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

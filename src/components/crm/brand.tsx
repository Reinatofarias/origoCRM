"use client";

import Image from "next/image";

export function BrandLogo({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image
        alt="OrigoCRM"
        className="object-contain"
        fill
        preload={!compact}
        sizes={compact ? "220px" : "(max-width: 768px) 92vw, 640px"}
        src="/origocrm-logo.png"
      />
    </div>
  );
}

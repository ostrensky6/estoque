import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";

type KontrolLogoProps = Omit<
  ImageProps,
  "src" | "alt" | "width" | "height" | "unoptimized" | "priority" | "preload" | "loading"
> & {
  alt?: string;
};

export function KontrolLogo({
  alt = "Kontrol App",
  className,
  ...props
}: KontrolLogoProps) {
  return (
    <>
      <span className="sr-only">{alt}</span>
      <Image
        {...props}
        src="/logos/kontrol-app.svg"
        alt=""
        aria-hidden="true"
        width={1735}
        height={339}
        className={cn(className, "dark:hidden")}
        unoptimized
      />
      <Image
        {...props}
        src="/logos/kontrol-app-dark.svg"
        alt=""
        aria-hidden="true"
        width={1735}
        height={339}
        className={cn("hidden", className, "dark:block")}
        unoptimized
      />
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image, { type StaticImageData } from "next/image";

interface HeroSlideshowProps {
  images: StaticImageData[];
  alt: string;
  sizes: string;
  className?: string;
  intervalMs?: number;
}

/**
 * Crossfades through a theme's hero photos (store exterior/interior shots).
 * Stacks `fill` images absolutely inside the caller's `relative` container —
 * no layout of its own — and always paints the first image eagerly so LCP
 * isn't delayed by the slideshow.
 */
export function HeroSlideshow({ images, alt, sizes, className, intervalMs = 6000 }: HeroSlideshowProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  return (
    <>
      {images.map((image, i) => (
        <Image
          key={i}
          src={image}
          alt={i === 0 ? alt : ""}
          fill
          priority={i === 0}
          placeholder="blur"
          sizes={sizes}
          aria-hidden={i === 0 ? undefined : true}
          className={`${className ?? ""} transition-opacity duration-1000 ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
    </>
  );
}

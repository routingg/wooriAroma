import type { ButtonHTMLAttributes } from "react";

/** Pairs with PrimaryButton in a step footer — e.g. a "back" action beside "next". */
export function SecondaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex min-h-14 items-center justify-center rounded-[var(--radius-button)] border border-stone-300 bg-transparent px-6 text-base font-medium text-stone-800 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-300 ${className}`}
      {...props}
    />
  );
}

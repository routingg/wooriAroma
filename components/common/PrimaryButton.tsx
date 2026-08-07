import type { ButtonHTMLAttributes } from "react";

export function PrimaryButton({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`flex min-h-14 w-full items-center justify-center rounded-full bg-stone-900 px-6 text-base font-medium text-stone-50 shadow-sm transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300 ${className}`}
      {...props}
    />
  );
}

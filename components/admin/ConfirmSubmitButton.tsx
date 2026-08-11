"use client";

import type { ReactNode } from "react";

/** Wraps a server-action form's submit button with a native confirm() for destructive actions (AGENTS.md §12.2). */
export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
}: {
  children: ReactNode;
  className?: string;
  confirmMessage: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

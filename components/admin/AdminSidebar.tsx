"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  /** Only the dashboard root needs an exact match — every other section owns its whole subtree (e.g. /admin/reservations/[id]). */
  exact?: boolean;
  icon: ReactNode;
}

const iconProps = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-5 w-5 shrink-0",
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "대시보드",
    exact: true,
    icon: (
      <svg {...iconProps}>
        <path d="M3 10.5 10 4l7 6.5" />
        <path d="M5 9v7h10V9" />
      </svg>
    ),
  },
  {
    href: "/admin/send-confirmation",
    label: "메일 발송",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="14" height="10" rx="1.5" />
        <path d="m3.5 5.5 6.5 5 6.5-5" />
      </svg>
    ),
  },
  {
    href: "/admin/blocked-times",
    label: "시간 관리",
    icon: (
      <svg {...iconProps}>
        <circle cx="10" cy="10.5" r="6.5" />
        <path d="M10 7v3.5l2.5 1.5" />
      </svg>
    ),
  },
  {
    href: "/admin/reservations",
    label: "예약 관리",
    icon: (
      <svg {...iconProps}>
        <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
        <path d="M3.5 8.5h13M7 3v3M13 3v3" />
      </svg>
    ),
  },
  {
    href: "/admin/notifications",
    label: "예약 알림",
    icon: (
      <svg {...iconProps}>
        <path d="M5 8a5 5 0 0 1 10 0c0 3.5 1 4.5 1 4.5H4S5 11.5 5 8Z" />
        <path d="M8.3 15.5a1.8 1.8 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    href: "/admin/agent-handoffs",
    label: "예외함",
    icon: (
      <svg {...iconProps}>
        <path d="M3.5 11 5 4.5h10L16.5 11" />
        <path d="M3.5 11v4.5h13V11h-3.6a2.4 2.4 0 0 1-4.8 0H3.5Z" />
      </svg>
    ),
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminSidebar({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();

  return (
    <div className="flex shrink-0 flex-col border-b border-stone-200 bg-white md:w-60 md:border-b-0 md:border-r">
      <div className="hidden items-center gap-2.5 px-5 pt-6 pb-5 md:flex">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest-500 text-base font-bold text-white">
          우
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">Woori Aroma</p>
          <p className="text-xs text-stone-400">관리자 대시보드</p>
        </div>
      </div>

      <nav
        aria-label="관리자 메뉴"
        className="flex shrink-0 gap-1 overflow-x-auto px-3 py-2 md:flex-col md:gap-1 md:px-3 md:pb-6"
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:shrink ${
                active ? "bg-forest-500 text-white shadow-sm" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              {item.icon}
              <span className="whitespace-nowrap">{item.label}</span>
              {item.href === "/admin/reservations" && pendingCount > 0 ? (
                <span
                  className={`ml-auto hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold md:inline ${
                    active ? "bg-white text-forest-700" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {pendingCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

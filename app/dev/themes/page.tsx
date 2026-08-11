import { notFound } from "next/navigation";
import { ThemesPreviewGrid } from "./ThemesPreviewGrid";

/**
 * Dev-only theme comparison tool (AGENTS §18 of the theming brief) — not
 * linked from anywhere customer-facing, and returns 404 outside development
 * so it never ships as reachable developer UI in production.
 */
export default function DevThemesPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Theme Preview</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Each card below is independently scoped with its own <code>data-theme</code>, so all five render with
          their real tokens simultaneously for direct comparison. Activating a theme sets it for the whole site
          (persisted in localStorage) and opens the real booking flow.
        </p>
      </div>
      <ThemesPreviewGrid />
    </main>
  );
}

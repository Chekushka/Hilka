/**
 * The Hilka mark: a line that forks — a plant's branch and a branch in code
 * (docs/mockups, the brand screen). No leaf, no tree. Stroke only, coloured through
 * design tokens, so it follows the theme without a second asset.
 *
 * `loading` makes the two forks light up in turn while the Python engine
 * loads — the same mark instead of a separate spinner. It is the one
 * continuous animation in the product, only ever shown for a few seconds,
 * and it stops for anyone who asked for reduced motion (app/globals.css).
 */
interface BrandMarkProps {
  size?: number;
  /** A Tailwind stroke utility; growth green by default. */
  className?: string;
  loading?: boolean;
}

export function BrandMark({ size = 20, className = 'stroke-growth', loading = false }: BrandMarkProps) {
  // Thicker at small sizes so the fork survives at 16 px, as the mockup's favicon row shows.
  const strokeWidth = size <= 20 ? 2.8 : size <= 36 ? 2.6 : 2.4;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 21V13" />
      <path d="M12 13L7 7.4" className={loading ? 'brand-fork-a' : undefined} />
      <path d="M12 13L17.2 4.2" className={loading ? 'brand-fork-b' : undefined} />
    </svg>
  );
}

/** Mark plus the lowercase wordmark: `header` for the app bar, `hero` for the entry page. */
export function BrandLockup({ variant = 'header' }: { variant?: 'header' | 'hero' }) {
  const hero = variant === 'hero';
  return (
    <span className={`inline-flex items-center ${hero ? 'gap-3' : 'gap-2'}`}>
      <BrandMark size={hero ? 34 : 20} />
      <span className={`font-medium tracking-tight text-ink ${hero ? 'text-3xl' : 'text-lg'}`}>hilka</span>
    </span>
  );
}

/**
 * Minimalist American flag logo for the OpenTax brand.
 *
 * Design: simplified flag with 5 stripes (3 red, 2 white), a small blue canton
 * with 8 star dots in a centered 3-2-3 pattern, and uniformly rounded corners.
 * Works at small sizes (32x20px) and scales up cleanly.
 */
export function AmericanFlagLogo({ className = 'h-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 24"
      className={className}
      aria-label="OpenTax"
      role="img"
    >
      <defs>
        <clipPath id="opentax-flag-clip">
          <rect width="40" height="24" rx="2.5" ry="2.5" />
        </clipPath>
      </defs>

      <g clipPath="url(#opentax-flag-clip)">
        {/* White background (visible as white stripes) */}
        <rect width="40" height="24" fill="#FFFFFF" />

        {/* Red stripes: 1st, 3rd, 5th (each 4.8px tall) */}
        <rect y="0" width="40" height="4.8" fill="#DC2626" />
        <rect y="9.6" width="40" height="4.8" fill="#DC2626" />
        <rect y="19.2" width="40" height="4.8" fill="#DC2626" />

        {/* Blue canton */}
        <rect width="16" height="14.4" fill="#1E40AF" />

        {/* Stars: centered 3-2-3 pattern in canton (16 x 14.4) */}
        {/* Row 1 */}
        <circle cx="4" cy="3.6" r="1.2" fill="#FFFFFF" />
        <circle cx="8" cy="3.6" r="1.2" fill="#FFFFFF" />
        <circle cx="12" cy="3.6" r="1.2" fill="#FFFFFF" />
        {/* Row 2 (offset) */}
        <circle cx="6" cy="7.2" r="1.2" fill="#FFFFFF" />
        <circle cx="10" cy="7.2" r="1.2" fill="#FFFFFF" />
        {/* Row 3 */}
        <circle cx="4" cy="10.8" r="1.2" fill="#FFFFFF" />
        <circle cx="8" cy="10.8" r="1.2" fill="#FFFFFF" />
        <circle cx="12" cy="10.8" r="1.2" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

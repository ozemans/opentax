/**
 * Minimalist American flag logo for the OpenTax brand.
 *
 * Design: simplified flag with 5 stripes (3 red, 2 white), a small blue canton
 * with 5 star dots, and slightly rounded corners for the modern aesthetic.
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
      {/* Outer rounded rect (white background for white stripes) */}
      <rect x="0" y="0" width="40" height="24" rx="2" ry="2" fill="#FFFFFF" />

      {/* Red stripes: 1st, 3rd, 5th (each 4.8px tall) */}
      <rect x="0" y="0" width="40" height="4.8" rx="2" ry="2" fill="#DC2626" />
      <rect x="0" y="0" width="40" height="4.8" fill="#DC2626" />
      {/* Use a clip for the top rounded corners on the first stripe */}
      <clipPath id="flag-clip">
        <rect x="0" y="0" width="40" height="24" rx="2" ry="2" />
      </clipPath>
      <g clipPath="url(#flag-clip)">
        <rect x="0" y="0" width="40" height="4.8" fill="#DC2626" />
        <rect x="0" y="9.6" width="40" height="4.8" fill="#DC2626" />
        <rect x="0" y="19.2" width="40" height="4.8" fill="#DC2626" />
      </g>

      {/* Blue canton */}
      <clipPath id="canton-clip">
        <rect x="0" y="0" width="40" height="24" rx="2" ry="2" />
      </clipPath>
      <g clipPath="url(#canton-clip)">
        <rect x="0" y="0" width="16" height="14.4" fill="#1E40AF" />
      </g>

      {/* Stars (5 small circles in the canton) */}
      <circle cx="4" cy="3.6" r="1.2" fill="#FFFFFF" />
      <circle cx="9" cy="3.6" r="1.2" fill="#FFFFFF" />
      <circle cx="13" cy="3.6" r="1.2" fill="#FFFFFF" />
      <circle cx="6.5" cy="7.8" r="1.2" fill="#FFFFFF" />
      <circle cx="11" cy="7.8" r="1.2" fill="#FFFFFF" />
      <circle cx="4" cy="11.6" r="1.2" fill="#FFFFFF" />
      <circle cx="9" cy="11.6" r="1.2" fill="#FFFFFF" />
      <circle cx="13" cy="11.6" r="1.2" fill="#FFFFFF" />
    </svg>
  );
}

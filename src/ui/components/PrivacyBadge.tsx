interface PrivacyBadgeProps {
  variant?: 'inline' | 'floating';
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function PrivacyBadge({ variant = 'inline' }: PrivacyBadgeProps) {
  if (variant === 'floating') {
    return (
      <div
        className="fixed bottom-4 left-4 z-40 hidden md:flex items-center gap-2
                    rounded-full bg-lavender-light/90 backdrop-blur-sm
                    px-4 py-2 shadow-card"
        role="status"
        aria-label="Privacy status"
      >
        <ShieldIcon className="h-4 w-4 text-teal-dark" />
        <span className="text-xs font-body text-slate-dark">
          Your data stays on this device
        </span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full bg-lavender-light
                  px-4 py-2"
      role="status"
      aria-label="Privacy status"
    >
      <ShieldIcon className="h-5 w-5 text-teal-dark" />
      <span className="text-sm font-body text-slate-dark">
        Your data stays on this device
      </span>
    </div>
  );
}

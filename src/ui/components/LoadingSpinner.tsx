interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
} as const;

export function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3" role="status">
      <div
        className={`${sizeMap[size]} animate-spin rounded-full
                    border-lavender border-t-teal`}
        aria-hidden="true"
      />
      {message && (
        <p className="text-sm font-body text-slate">{message}</p>
      )}
      <span className="sr-only">{message || 'Loading...'}</span>
    </div>
  );
}

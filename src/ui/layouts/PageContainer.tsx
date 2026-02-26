interface PageContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function PageContainer({ title, description, children }: PageContainerProps) {
  return (
    <div className="w-full max-w-full">
      <div className="rounded-2xl bg-white shadow-card p-5 md:p-8">
        <h1
          tabIndex={-1}
          className="text-2xl font-display font-bold text-slate-dark
                     focus:outline-none"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm font-body text-slate">
            {description}
          </p>
        )}
        <div className="mt-6">
          {children}
        </div>
      </div>
    </div>
  );
}

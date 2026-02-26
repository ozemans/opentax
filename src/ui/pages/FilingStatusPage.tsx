import type { FilingStatus } from '@/engine/types';
import { FilingStatusCard } from '@/ui/components/FilingStatusCard';
import { FILING_STATUS_OPTIONS } from '@/ui/data/filingStatusOptions';
import { useFocusOnPageChange } from '@/ui/hooks/useFocusOnPageChange';
import { useAnnounce } from '@/ui/hooks/useAnnounce';
import { PageContainer } from '@/ui/layouts/PageContainer';
import { useTaxState } from '@/ui/hooks/useTaxState';

export function FilingStatusPage() {
  const { input, dispatch } = useTaxState();
  const selected = input.filingStatus;

  const headingRef = useFocusOnPageChange('filing-status');
  const announce = useAnnounce();

  function handleSelect(value: FilingStatus) {
    dispatch({ type: 'SET_FIELD', path: 'filingStatus', value });
    const option = FILING_STATUS_OPTIONS.find((o) => o.value === value);
    if (option) {
      announce(`Selected ${option.label}`);
    }
  }

  return (
    <PageContainer
      title="Filing Status"
      description="Choose the filing status that applies to you. This determines your tax brackets and standard deduction."
    >
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        Filing Status
      </h1>

      <div
        role="radiogroup"
        aria-label="Filing status options"
        className="space-y-3"
      >
        {FILING_STATUS_OPTIONS.map((option) => (
          <FilingStatusCard
            key={option.value}
            value={option.value}
            label={option.label}
            description={option.description}
            icon={option.icon}
            isSelected={selected === option.value}
            onSelect={() => handleSelect(option.value)}
          />
        ))}
      </div>
    </PageContainer>
  );
}

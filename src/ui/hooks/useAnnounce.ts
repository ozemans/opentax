import { useCallback } from 'react';

const ANNOUNCER_ID = 'sr-announcements';

function getOrCreateAnnouncer(): HTMLDivElement {
  let el = document.getElementById(ANNOUNCER_ID) as HTMLDivElement | null;
  if (el) return el;

  el = document.createElement('div');
  el.id = ANNOUNCER_ID;
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.setAttribute('role', 'status');
  Object.assign(el.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  document.body.appendChild(el);
  return el;
}

/**
 * Returns a function that announces messages to screen readers via
 * a persistent hidden live region. Defaults to "polite" priority.
 */
export function useAnnounce(): (message: string, priority?: 'polite' | 'assertive') => void {
  return useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = getOrCreateAnnouncer();
    announcer.setAttribute('aria-live', priority);

    // Clear then set to ensure the same message is re-announced
    announcer.textContent = '';
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  }, []);
}

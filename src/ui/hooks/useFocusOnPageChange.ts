import { useEffect, useRef } from 'react';

/**
 * Returns a ref to attach to a page's <h1>. When `pageId` changes,
 * the heading is focused so screen readers announce the new page.
 */
export function useFocusOnPageChange(pageId: string): React.RefObject<HTMLHeadingElement | null> {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPageId = useRef<string>(pageId);

  useEffect(() => {
    if (previousPageId.current !== pageId) {
      previousPageId.current = pageId;
      // Small delay to ensure the DOM has updated after route change
      const timer = setTimeout(() => {
        headingRef.current?.focus({ preventScroll: false });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pageId]);

  return headingRef;
}

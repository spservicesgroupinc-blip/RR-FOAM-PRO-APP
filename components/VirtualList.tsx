import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';

interface VirtualListProps<T> {
  /** All items to render */
  items: T[];
  /** Fixed height of each row in pixels */
  rowHeight: number;
  /** Max visible height (container height) */
  containerHeight: number;
  /** Number of extra items to render above/below viewport */
  overscan?: number;
  /** Render function for each visible item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Optional className for the scroll container */
  className?: string;
  /** Threshold to enable virtualization (below this, render all items) */
  virtualizeThreshold?: number;
}

export function VirtualList<T>({
  items,
  rowHeight,
  containerHeight,
  overscan = 5,
  renderItem,
  className = '',
  virtualizeThreshold = 50,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // If below threshold, render everything normally (no virtualization overhead)
  if (items.length < virtualizeThreshold) {
    return (
      <div className={className}>
        {items.map((item, idx) => (
          <div key={idx}>{renderItem(item, idx)}</div>
        ))}
      </div>
    );
  }

  const totalHeight = items.length * rowHeight;
  const visibleCount = Math.ceil(containerHeight / rowHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + 2 * overscan);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: startIndex * rowHeight,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, idx) => (
            <div key={startIndex + idx} style={{ height: rowHeight }}>
              {renderItem(item, startIndex + idx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(VirtualList) as typeof VirtualList;

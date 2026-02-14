import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onGoToPage: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const PaginationControls: React.FC<PaginationControlsProps> = React.memo(({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  onGoToPage,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}) => {
  if (totalItems <= pageSizeOptions[0]) return null;

  // Generate page buttons with ellipsis logic
  const getPageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
      {/* Item count & page size selector */}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="font-medium">
          {startItem}–{endItem} of {totalItems}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 bg-white"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        )}
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPreviousPage}
          disabled={!hasPreviousPage}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-xs">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onGoToPage(page)}
              className={`min-w-[32px] h-8 rounded-lg text-xs font-bold transition-colors ${
                page === currentPage
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

PaginationControls.displayName = 'PaginationControls';

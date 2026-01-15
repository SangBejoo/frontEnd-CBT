import { useState, useCallback, useMemo } from 'react';

export interface UsePaginationOptions {
  itemsPerPage?: number;
}

export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = { itemsPerPage: 10 }
) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = options.itemsPerPage || 10;

  const totalPages = useMemo(
    () => Math.ceil(items.length / itemsPerPage),
    [items.length, itemsPerPage]
  );

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, itemsPerPage]);

  const goToPage = useCallback((page: number) => {
    const pageNum = Math.max(1, Math.min(page, totalPages || 1));
    setCurrentPage(pageNum);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages || 1));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    reset,
  };
}

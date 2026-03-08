import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
  baseUrl: string;
  searchParams?: Record<string, string>;
}

export function Pagination({
  currentPage,
  pageSize,
  hasMore,
  baseUrl,
  searchParams = {},
}: PaginationProps) {
  const hasPrev = currentPage > 1;

  function buildUrl(page: number) {
    const params = new URLSearchParams(searchParams);
    if (page > 1) {
      params.set("page", String(page));
    } else {
      params.delete("page");
    }
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  if (!hasPrev && !hasMore) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <div>
        {hasPrev ? (
          <Link
            href={buildUrl(currentPage - 1)}
            className="flex items-center gap-1 px-4 py-2 bg-workshop-elevated hover:bg-workshop-border text-workshop-text rounded-md text-sm font-medium transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Föregående
          </Link>
        ) : (
          <span />
        )}
      </div>
      <span className="text-xs text-workshop-muted">Sida {currentPage}</span>
      <div>
        {hasMore ? (
          <Link
            href={buildUrl(currentPage + 1)}
            className="flex items-center gap-1 px-4 py-2 bg-workshop-elevated hover:bg-workshop-border text-workshop-text rounded-md text-sm font-medium transition-colors"
          >
            Nästa
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

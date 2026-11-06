import Link from "next/link";
import { buttonClass } from "./button";

export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (v && k !== "page") params.set(k, v);
    params.set("page", String(p));
    return `?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
      <span>
        Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={buttonClass("outline", "sm")}>
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={buttonClass("outline", "sm")}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}

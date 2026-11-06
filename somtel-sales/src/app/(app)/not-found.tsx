import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto mt-20 max-w-md text-center">
      <h1 className="text-xl font-semibold text-navy">Not found</h1>
      <p className="mt-2 text-sm text-gray-500">This record does not exist, was deleted, or you cannot see it.</p>
      <Link href="/" className={buttonClass("navy", "md", "mt-6")}>
        Go to my dashboard
      </Link>
    </div>
  );
}

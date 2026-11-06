import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NoAccessPage() {
  return (
    <div className="mx-auto mt-20 max-w-md text-center">
      <h1 className="text-xl font-semibold text-navy">You do not have access to this page</h1>
      <p className="mt-2 text-sm text-gray-500">If you need access, ask an Admin to add the right role to your account.</p>
      <Link href="/" className={buttonClass("navy", "md", "mt-6")}>
        Go to my dashboard
      </Link>
    </div>
  );
}

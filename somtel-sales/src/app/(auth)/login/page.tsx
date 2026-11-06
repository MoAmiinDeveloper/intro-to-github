import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

function safePath(next?: string, callbackUrl?: string): string {
  const raw = next ?? callbackUrl ?? "/";
  try {
    const url = new URL(raw, "http://local");
    const path = url.pathname + url.search;
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login") ? path : "/";
  } catch {
    return "/";
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; callbackUrl?: string; reset?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/api/branding/logo" alt="Somtel" className="mb-8 h-12 w-auto lg:hidden" />
      <h2 className="text-2xl font-semibold text-navy">Sign in</h2>
      <p className="mb-6 mt-1 text-sm text-gray-500">Use your work email and password.</p>
      {sp.reset && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Your password was changed. Please sign in.</p>
      )}
      <LoginForm next={safePath(sp.next, sp.callbackUrl)} />
    </>
  );
}

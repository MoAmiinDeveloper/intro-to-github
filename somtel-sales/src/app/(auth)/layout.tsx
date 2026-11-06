export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-navy p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/branding/logo" alt="Somtel" className="h-10 w-auto rounded bg-white p-1" />
        </div>
        <div>
          <div className="mb-4 h-1 w-16 bg-gold" />
          <h1 className="text-3xl font-semibold leading-tight">Enterprise Sales System</h1>
          <p className="mt-3 max-w-md text-navy-100">
            Leads, deals, quotes, orders, activation and renewals in one place.
          </p>
        </div>
        <p className="text-xs text-navy-200">Somtel Enterprise, Hargeisa</p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

// Dynamic so the per-request CSP nonce from `proxy.ts` reaches Next's inline scripts.
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F6F4F0] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-lg font-semibold tracking-[0.42em] text-[#1A1A1A]">MAEYJA</p>
          <p className="mt-1 text-[11px] tracking-[0.14em] text-neutral-500 uppercase">Yönetim paneli</p>
        </div>
        <div className="rounded-2xl border border-[#E8E3DA] bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

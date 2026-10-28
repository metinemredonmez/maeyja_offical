export function Accordion({ items }: { items: { title: string; body: string | null | undefined; open?: boolean }[] }) {
  return (
    <div className="border-t border-line">
      {items.map((item) => (
        <details key={item.title} open={item.open} className="group border-b border-line">
          <summary className="label flex cursor-pointer list-none items-center justify-between py-4 [&::-webkit-details-marker]:hidden">
            <span>{item.title}</span>
            <span aria-hidden="true" className="text-base font-light group-open:hidden">+</span>
            <span aria-hidden="true" className="hidden text-base font-light group-open:inline">−</span>
          </summary>
          <p className="whitespace-pre-line pb-5 text-[13px] leading-relaxed text-ink-soft">{item.body}</p>
        </details>
      ))}
    </div>
  );
}

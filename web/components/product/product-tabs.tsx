'use client';

import { useId, useState } from 'react';

/** Polène-style horizontal tabs under the buy button; the text reads in the serif. */
export function ProductTabs({ items }: { items: { id: string; title: string; body: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const base = useId();
  const current = items.find((i) => i.id === active) ?? items[0];
  if (!current) return null;
  return (
    <div className="w-full">
      <div role="tablist" className="flex flex-wrap justify-center gap-x-6 gap-y-2 border-b border-line">
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            role="tab"
            id={`${base}-${i.id}`}
            aria-selected={i.id === current.id}
            aria-controls={`${base}-panel`}
            onClick={() => setActive(i.id)}
            className={`label -mb-px border-b pb-3 transition-colors ${i.id === current.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {i.title}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${current.id}`} className="whitespace-pre-line pt-5 text-left font-serif text-[17px] leading-relaxed text-ink-soft md:max-h-[26vh] md:overflow-y-auto">
        {current.body}
      </div>
    </div>
  );
}

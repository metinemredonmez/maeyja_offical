import { cn } from '@/lib/utils';
import { CONTENT_STATUS, ORDER_STATUS, PAYMENT_STATUS, PRODUCT_STATUS, PUSH_STATUS, RETURN_STATUS, type Tone } from '@/lib/labels';
import type { ContentStatus, OrderStatus, PaymentStatus, ProductStatus, PushStatus, ReturnStatus } from '@/lib/types';

const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
  muted: 'bg-neutral-50 text-neutral-500 ring-neutral-200',
};

export function ToneBadge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px] font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}

type Props =
  | { kind: 'order'; value: OrderStatus }
  | { kind: 'product'; value: ProductStatus }
  | { kind: 'return'; value: ReturnStatus }
  | { kind: 'payment'; value: PaymentStatus }
  | { kind: 'content'; value: ContentStatus }
  | { kind: 'push'; value: PushStatus }
  | { kind: 'active'; value: boolean };

export function StatusBadge(props: Props & { className?: string }) {
  let label: string;
  let tone: Tone;
  switch (props.kind) {
    case 'order':
      ({ label, tone } = ORDER_STATUS[props.value] ?? { label: props.value, tone: 'neutral' });
      break;
    case 'product':
      ({ label, tone } = PRODUCT_STATUS[props.value] ?? { label: props.value, tone: 'neutral' });
      break;
    case 'return':
      ({ label, tone } = RETURN_STATUS[props.value] ?? { label: props.value, tone: 'neutral' });
      break;
    case 'payment':
      ({ label, tone } = PAYMENT_STATUS[props.value] ?? { label: props.value, tone: 'neutral' });
      break;
    case 'content':
      ({ label, tone } = CONTENT_STATUS[props.value] ?? { label: props.value, tone: 'neutral' });
      break;
    case 'push':
      ({ label, tone } = PUSH_STATUS[props.value] ?? { label: props.value, tone: 'neutral' });
      break;
    case 'active':
      label = props.value ? 'Aktif' : 'Pasif';
      tone = props.value ? 'success' : 'muted';
      break;
  }
  return (
    <ToneBadge tone={tone} className={props.className} dot>
      {label}
    </ToneBadge>
  );
}

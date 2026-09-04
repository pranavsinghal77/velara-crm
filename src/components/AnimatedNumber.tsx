import { useCountUp } from '../lib/motion';

interface AnimatedNumberProps {
  value: number;
  /** Decimal places. Fixed, so the digits do not jitter in width as it counts. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Group thousands (1,240). Off by default; lakh figures read better plain. */
  grouped?: boolean;
  durationMs?: number;
  className?: string;
}

/**
 * A figure that counts to its value instead of appearing at it.
 *
 * Used for the KPI headlines. The point is not decoration: when a lead is
 * created and the pipeline total changes, the number moving is what tells you
 * *which* card responded. A silent digit swap on four cards at once tells you
 * nothing.
 *
 * The rendered text is always the real value once settled, and immediately so
 * when motion is reduced.
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  grouped = false,
  durationMs,
  className,
}: AnimatedNumberProps) {
  const current = useCountUp(value, durationMs);

  const formatted = Number.isFinite(current)
    ? current.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: grouped,
      })
    : String(value);

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

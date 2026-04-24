import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** When true, removes the default padding — useful for table-in-card layouts. */
  flush?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, flush = false, className = '', ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[
        'rounded-l border border-hairline-strong bg-surface-1 shadow-sm',
        flush ? '' : 'p-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
});

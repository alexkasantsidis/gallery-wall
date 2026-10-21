import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as RSlider from '@radix-ui/react-slider';
import * as RPopover from '@radix-ui/react-popover';
import { HexColorPicker } from 'react-colorful';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { formatCm, formatInches, parseLength } from '../model/units';
import type { Units } from '../model/types';

export function Tip({ label, children, side = 'bottom' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip.Root delayDuration={350}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={8} className="z-50 rounded-lg bg-ink-950/95 px-2.5 py-1.5 text-[11px] font-medium text-ink-200 shadow-xl ring-1 ring-white/10">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; label?: ReactNode; tipSide?: 'top' | 'bottom' | 'left' | 'right' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ active, label, tipSide, className, children, ...rest }, ref) {
  const btn = (
    <button
      ref={ref}
      {...rest}
      className={clsx(
        'grid h-8 min-w-8 place-items-center rounded-lg px-1.5 text-ink-300 transition-colors hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-35',
        active && 'bg-accent/20 text-accent-soft hover:bg-accent/25 hover:text-accent-soft',
        className,
      )}
    >
      {children}
    </button>
  );
  return label ? (
    <Tip label={label} side={tipSide}>
      {btn}
    </Tip>
  ) : (
    btn
  );
});

export function Button({ className, variant = 'ghost', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'ghost' | 'primary' | 'soft' | 'danger' }) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-accent text-white shadow-[0_4px_16px_rgba(139,124,246,0.35)] hover:bg-accent-soft',
        variant === 'soft' && 'bg-white/6 text-ink-200 hover:bg-white/10 hover:text-white',
        variant === 'ghost' && 'text-ink-300 hover:bg-white/8 hover:text-white',
        variant === 'danger' && 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
        className,
      )}
    />
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <motion.section layout="position" className="border-b border-white/6 px-4 py-3.5 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[10.5px] font-semibold tracking-[0.08em] text-ink-400 uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </motion.section>
  );
}

export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 text-[12px] text-ink-300">
      <span className="shrink-0">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  className,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  className?: string;
}) {
  return (
    <RSlider.Root
      className={clsx('relative flex h-5 touch-none items-center select-none', className ?? 'w-full')}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
      onValueCommit={() => onCommit?.()}
    >
      <RSlider.Track className="relative h-1 grow rounded-full bg-white/10">
        <RSlider.Range className="absolute h-full rounded-full bg-accent" />
      </RSlider.Track>
      <RSlider.Thumb className="block h-3.5 w-3.5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.5)] ring-accent/40 transition-[box-shadow] outline-none hover:ring-4 focus-visible:ring-4" />
    </RSlider.Root>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="relative flex rounded-lg bg-white/5 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            'relative z-10 flex-1 rounded-md font-medium whitespace-nowrap transition-colors',
            size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-[12px]',
            value === o.value ? 'text-white' : 'text-ink-400 hover:text-ink-200',
          )}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 -z-10 rounded-md bg-white/12 shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-white/12')}
    >
      <motion.span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow" animate={{ x: checked ? 16 : 0 }} transition={{ type: 'spring', stiffness: 600, damping: 35 }} />
    </button>
  );
}

/** A length input that accepts 11 1/4, 11¼, 28.5 etc. and shows values in the current units. */
export function LengthInput({ value, units, onChange, className, min = 0, ariaLabel }: { value: number; units: Units; onChange: (v: number) => void; className?: string; min?: number; ariaLabel?: string }) {
  const fmt = (v: number) => (units === 'cm' ? formatCm(v) : formatInches(v));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, units]);
  const commitText = () => {
    const v = parseLength(text, units);
    if (v != null && v >= min) onChange(v);
    else setText(fmt(value));
  };
  return (
    <div className={clsx('flex h-7 items-center rounded-md bg-white/6 ring-1 ring-white/6 focus-within:ring-accent/70', className)}>
      <input
        aria-label={ariaLabel}
        value={text}
        onFocus={(e) => {
          focused.current = true;
          e.target.select();
        }}
        onBlur={() => {
          focused.current = false;
          commitText();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(fmt(value));
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = (units === 'cm' ? 0.5 / 2.54 : 0.25) * (e.shiftKey ? 4 : 1);
            onChange(Math.max(min, value + (e.key === 'ArrowUp' ? step : -step)));
          }
        }}
        className="w-full min-w-0 bg-transparent px-2 text-right text-[12px] text-white tabular-nums outline-none"
      />
      <span className="pr-2 text-[11px] text-ink-500">{units === 'cm' ? 'cm' : 'in'}</span>
    </div>
  );
}

export function Swatches({ colors, value, onChange, custom = true, size = 22 }: { colors: string[]; value: string; onChange: (c: string) => void; custom?: boolean; size?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onChange(c)}
          style={{ background: c, width: size, height: size }}
          className={clsx('rounded-full ring-1 ring-white/15 ring-inset transition-transform hover:scale-110', value.toLowerCase() === c.toLowerCase() && 'outline-2 outline-offset-2 outline-accent')}
        />
      ))}
      {custom && <ColorPop value={value} onChange={onChange} size={size} />}
    </div>
  );
}

export function ColorPop({ value, onChange, size = 22 }: { value: string; onChange: (c: string) => void; size?: number }) {
  return (
    <RPopover.Root>
      <RPopover.Trigger asChild>
        <button
          title="Custom colour"
          style={{ width: size, height: size, background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)` }}
          className="rounded-full ring-1 ring-white/20 transition-transform hover:scale-110"
        />
      </RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content side="left" sideOffset={10} className="glass z-50 rounded-xl p-3">
          <HexColorPicker color={value} onChange={onChange} />
          <input
            value={value}
            onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && onChange(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="mt-2 w-full rounded-md bg-white/6 px-2 py-1 text-[12px] text-white outline-none"
          />
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

export { RPopover as Popover };

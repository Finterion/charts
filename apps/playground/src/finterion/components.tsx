/**
 * Lightweight React primitives that render the Finterion design tokens
 * (`./tokens.ts`). The goal is just to give the playground demos a
 * consistent look — these are not meant to be a general component library.
 */
import { CSSProperties, ReactNode } from 'react';
import { colors, radii, spacing } from './tokens';

// ───────────────────────── Top app bar ─────────────────────────
export interface TopBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  /** A small uppercase tag rendered next to the title (e.g. "DEMO"). */
  tag?: string;
}

export function TopBar({ title, subtitle, right, tag }: TopBarProps) {
  return (
    <div
      style={{
        height: 56,
        padding: '0 24px',
        background: colors.canvas,
        borderBottom: `1px solid ${colors.hairline}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.lg,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 26,
          height: 26,
          borderRadius: radii.sm,
          background: colors.ink,
          color: colors.canvas,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        Fn
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: spacing.sm,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 14,
            fontWeight: 600,
            color: colors.ink,
            lineHeight: 1.2,
          }}
        >
          <span>{title}</span>
          {tag ? (
            <span
              style={{
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: 1,
                color: colors.primary,
                background: colors.primarySubtle,
                padding: '1px 6px',
                borderRadius: radii.sm,
              }}
            >
              {tag}
            </span>
          ) : null}
        </div>
        {subtitle ? (
          <div
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 12,
              color: colors.inkMuted,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1 }} />
      {right}
    </div>
  );
}

// ───────────────────────── Page chrome ─────────────────────────
export interface PageShellProps {
  children: ReactNode;
  /** Optional extra padding around the main content area. */
  padding?: CSSProperties['padding'];
  /** Constrain the inner container width. */
  maxWidth?: number;
}

export function PageShell({ children, padding = `${spacing.xl}px`, maxWidth }: PageShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.canvasSubtle,
        color: colors.ink,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          padding,
          maxWidth,
          margin: maxWidth ? '0 auto' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ───────────────────────── Card ─────────────────────────
export interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  padding?: CSSProperties['padding'];
}

export function Card({ children, style, padding = `${spacing.lg}px ${spacing.xl}px` }: CardProps) {
  return (
    <div
      style={{
        background: colors.canvas,
        border: `1px solid ${colors.hairline}`,
        borderRadius: radii.sm,
        boxShadow: `0 1px 0 ${colors.shadowCard}`,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.lg,
        paddingBottom: spacing.md,
        marginBottom: spacing.md,
        borderBottom: `1px solid ${colors.hairlineSoft}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 16,
            fontWeight: 600,
            color: colors.ink,
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 12,
              color: colors.inkMuted,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ? <div style={{ flexShrink: 0 }}>{right}</div> : null}
    </div>
  );
}

// ───────────────────────── Overline label ─────────────────────────
export function Overline({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: colors.inkMuted,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ───────────────────────── KPI tile ─────────────────────────
export interface KpiTileProps {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  /** Positive/negative styling for the delta. */
  tone?: 'up' | 'down' | 'flat' | 'neutral';
  style?: CSSProperties;
}

export function KpiTile({ label, value, delta, tone = 'neutral', style }: KpiTileProps) {
  const deltaColor =
    tone === 'up'
      ? colors.quantUp
      : tone === 'down'
        ? colors.quantDown
        : tone === 'flat'
          ? colors.quantFlat
          : colors.inkMuted;
  return (
    <div
      style={{
        background: colors.canvas,
        border: `1px solid ${colors.hairline}`,
        borderRadius: radii.md,
        padding: `${spacing.md}px ${spacing.lg}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontWeight: 600,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: colors.inkMuted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontWeight: 600,
          fontSize: 22,
          lineHeight: 1.15,
          letterSpacing: -0.3,
          fontVariantNumeric: 'tabular-nums',
          color: colors.ink,
        }}
      >
        {value}
      </div>
      {delta !== undefined ? (
        <div
          style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontWeight: 500,
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            color: deltaColor,
          }}
        >
          {delta}
        </div>
      ) : null}
    </div>
  );
}

// ───────────────────────── Buttons ─────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  title?: string;
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  active = false,
  disabled = false,
  style,
  title,
}: ButtonProps) {
  const height = size === 'sm' ? 28 : 32;
  const padX = size === 'sm' ? 10 : 12;
  const fontSize = size === 'sm' ? 12 : 14;

  let bg: string = colors.canvasSubtle;
  let fg: string = colors.ink;
  let border: string = colors.hairline;

  if (variant === 'primary' || (variant === 'secondary' && active)) {
    bg = colors.primary;
    fg = colors.onPrimary;
    border = colors.primary;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    border = 'transparent';
    fg = active ? colors.primary : colors.ink;
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        height,
        padding: `0 ${padX}px`,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: radii.sm,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 500,
        fontSize,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 80ms ease, color 80ms ease, border-color 80ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// Toggle group — a row of segmented buttons.
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: Array<{ label: string; value: T; title?: string }>;
  value: T;
  onChange: (next: T) => void;
  size?: ButtonSize;
}) {
  const height = size === 'sm' ? 28 : 32;
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        height,
        borderRadius: radii.sm,
        border: `1px solid ${colors.hairline}`,
        background: colors.canvas,
        overflow: 'hidden',
      }}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            role="tab"
            aria-selected={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            style={{
              height: '100%',
              padding: `0 ${size === 'sm' ? 10 : 14}px`,
              background: active ? colors.primary : 'transparent',
              color: active ? colors.onPrimary : colors.ink,
              border: 'none',
              borderLeft: i === 0 ? 'none' : `1px solid ${colors.hairline}`,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: size === 'sm' ? 12 : 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 80ms ease, color 80ms ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

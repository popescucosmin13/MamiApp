// src/components/ui.tsx — small reusable building blocks matching the design system
import type { ReactNode, CSSProperties } from 'react';

/** Shimmering placeholder for loading states. */
export function Skeleton({ width, height = 14, radius = 6, style }: {
  width?: number | string; height?: number | string; radius?: number; style?: CSSProperties;
}) {
  return (
    <span
      className="pulse"
      style={{
        display: 'block',
        width: width ?? '100%',
        height,
        borderRadius: radius,
        background: 'linear-gradient(90deg, var(--surface), var(--surface2), var(--surface))',
        ...style,
      }}
    />
  );
}

/** A block of skeleton rows for tables/lists. */
export function SkeletonRows({ rows = 5, height = 44 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={height} radius={10} />
      ))}
    </div>
  );
}

/** Consistent empty state with optional action. */
export function EmptyState({ icon = '🫧', title, description, action }: {
  icon?: string; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: 'var(--surface)',
        border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 26,
      }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 380 }}>{description}</div>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

/** Page header with title, subtitle and optional actions on the right. */
export function PageHeader({ title, subtitle, icon, actions }: {
  title: string; subtitle?: string; icon?: string; actions?: ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap', marginBottom: 20,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
          }}>{icon}</div>
        )}
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

/** A compact metric tile. */
export function StatTile({ label, value, delta, icon, color = 'var(--accent)', loading }: {
  label: string; value: ReactNode; delta?: string; icon?: string; color?: string; loading?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{label}</span>
        {icon && (
          <span style={{
            width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>{icon}</span>
        )}
      </div>
      {loading ? (
        <Skeleton width={80} height={26} />
      ) : (
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
      )}
      {delta && <div style={{ fontSize: 12, color, fontWeight: 600 }}>{delta}</div>}
    </div>
  );
}

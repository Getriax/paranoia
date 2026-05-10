import React from 'react';

interface DossierFrameProps {
  children: React.ReactNode;
  caseNo?: string;
  classification?: string;
  page?: number;
  totalPages?: number;
}

export const DossierFrame: React.FC<DossierFrameProps> = ({
  children,
  caseNo = 'PR-2148-09',
  classification = 'CONFIDENTIAL',
  page = 1,
  totalPages = 4,
}) => (
  <div
    style={{
      width: '100%',
      maxWidth: 375,
      minHeight: '100dvh',
      background: '#efe9dc',
      color: '#1a1815',
      fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
      fontSize: 11,
      lineHeight: 1.5,
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.012) 0 1px, transparent 1px 4px),
                        radial-gradient(circle at 30% 20%, rgba(120,90,40,0.04), transparent 60%),
                        radial-gradient(circle at 80% 80%, rgba(80,40,20,0.05), transparent 50%)`,
    }}
  >
    {/* top header strip */}
    <div
      style={{
        borderBottom: '1.5px solid #1a1815',
        padding: '10px 14px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontSize: 9,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}
    >
      <span style={{ fontWeight: 700 }}>FORM 14-B / PARANOIA</span>
      <span style={{ color: '#7a6f60' }}>{caseNo}</span>
    </div>
    <div
      style={{
        borderBottom: '0.5px solid #1a1815',
        padding: '4px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 8.5,
        letterSpacing: 1.2,
        color: '#8a1c14',
        fontWeight: 700,
      }}
    >
      <span>// {classification} //</span>
      <span>
        PG {String(page).padStart(2, '0')}/{String(totalPages).padStart(2, '0')}
      </span>
    </div>

    {children}

    {/* bottom footer */}
    <div
      style={{
        borderTop: '0.5px solid #1a1815',
        padding: '6px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 8,
        letterSpacing: 1,
        color: '#7a6f60',
      }}
    >
      <span>DO NOT REPRODUCE</span>
      <span>05·10·26 · 14:22Z</span>
    </div>
  </div>
);

interface StampProps {
  children: React.ReactNode;
  color?: string;
  rotate?: number;
  style?: React.CSSProperties;
}

export const Stamp: React.FC<StampProps> = ({
  children,
  color = '#8a1c14',
  rotate = -8,
  style = {},
}) => (
  <div
    style={{
      display: 'inline-block',
      border: `2.5px solid ${color}`,
      color,
      fontWeight: 800,
      letterSpacing: 2,
      fontSize: 10,
      padding: '5px 9px',
      transform: `rotate(${rotate}deg)`,
      background: 'transparent',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
      fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
      opacity: 0.92,
      ...style,
    }}
  >
    {children}
  </div>
);

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

export const FieldRow: React.FC<FieldRowProps> = ({ label, value, mono = true }) => (
  <div
    style={{
      display: 'flex',
      borderBottom: '0.5px dashed #1a1815',
      padding: '5px 0',
      fontSize: 10,
    }}
  >
    <span
      style={{
        width: 90,
        color: '#7a6f60',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        fontSize: 9,
      }}
    >
      {label}
    </span>
    <span style={{ flex: 1, fontWeight: mono ? 600 : 400 }}>{value}</span>
  </div>
);

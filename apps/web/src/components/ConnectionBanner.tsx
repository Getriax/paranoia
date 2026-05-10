import React from 'react';
import type { SocketStatus } from '../hooks/useGameSocket.js';

interface ConnectionBannerProps {
  status: SocketStatus;
}

export const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ status }) => {
  if (status !== 'reconnecting' && status !== 'error') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#a32118',
        color: '#efe9dc',
        textAlign: 'center',
        padding: '6px 14px',
        fontSize: 9,
        letterSpacing: 2,
        fontWeight: 700,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
      }}
    >
      {status === 'reconnecting' ? '⟳ RECONNECTING — STAND BY' : '✕ CONNECTION LOST'}
    </div>
  );
};

interface OpponentDisconnectModalProps {
  deadline: string;
  onDismiss?: () => void;
}

export const OpponentDisconnectModal: React.FC<OpponentDisconnectModalProps> = ({
  deadline,
}) => {
  const [remaining, setRemaining] = React.useState<string>('');

  React.useEffect(() => {
    const update = () => {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) {
        setRemaining('00:00');
        return;
      }
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      setRemaining(`${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,24,21,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9998,
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
      }}
    >
      <div
        style={{
          background: '#efe9dc',
          border: '1.5px solid #1a1815',
          padding: '24px 20px',
          maxWidth: 300,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 9,
            letterSpacing: 2,
            color: '#7a6f60',
            marginBottom: 8,
          }}
        >
          SECTION — INTERRUPTION
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: -0.5,
            color: '#1a1815',
            marginBottom: 6,
          }}
        >
          SUBJECT DISCONNECTED.
        </div>
        <div style={{ fontSize: 10, color: '#3a3530', marginBottom: 16 }}>
          Awaiting reconnection. File closes in:
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: 4,
            color: '#a32118',
          }}
        >
          {remaining}
        </div>
      </div>
    </div>
  );
};

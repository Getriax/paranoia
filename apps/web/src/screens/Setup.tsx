import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DossierFrame, Stamp } from '../components/DossierFrame.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { ConnectionBanner } from '../components/ConnectionBanner.js';
import { ServerEvents, ClientEvents } from '@openclaw/shared';

const TURN_OPTIONS = [4, 6, 8] as const;
type TurnOption = (typeof TURN_OPTIONS)[number];

const CATEGORY_OPTIONS = [
  'RELATIONSHIPS',
  'WORLD',
  'HYPOTHETICAL',
  'PERSONAL',
  'CREATIVE',
] as const;
type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

interface SelectRowProps {
  label: string;
  options: readonly string[];
  active: string;
  onSelect: (v: string) => void;
}

const SelectRow: React.FC<SelectRowProps> = ({ label, options, active, onSelect }) => (
  <div style={{ borderBottom: '0.5px dashed #1a1815', padding: '10px 0 12px' }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 7,
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: 1.2,
          color: '#7a6f60',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 9, color: '#1a1815' }}>{active}</span>
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onSelect(o)}
          style={{
            padding: '5px 9px',
            border: '1px solid #1a1815',
            background: o === active ? '#1a1815' : 'transparent',
            color: o === active ? '#efe9dc' : '#1a1815',
            fontSize: 10,
            letterSpacing: 0.5,
            fontWeight: 600,
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
            cursor: 'pointer',
          }}
        >
          {o}
        </button>
      ))}
    </div>
  </div>
);

export const Setup: React.FC = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [turns, setTurns] = useState<TurnOption>(6);
  const [category, setCategory] = useState<CategoryOption>('RELATIONSHIPS');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { status, emit, on } = useGameSocket();

  React.useEffect(() => {
    const offCreated = on(ServerEvents.LOBBY_CREATED, (payload) => {
      localStorage.setItem(`session_${payload.gameId}`, payload.sessionToken);
      localStorage.setItem(`playerId_${payload.gameId}`, payload.playerId);
      setLoading(false);
      navigate(`/lobby/${payload.roomCode}?gameId=${payload.gameId}`);
    });

    const offJoined = on(ServerEvents.LOBBY_JOINED, (payload) => {
      localStorage.setItem(`session_${payload.gameId}`, payload.sessionToken);
      localStorage.setItem(`playerId_${payload.gameId}`, payload.playerId);
      // Persist host's nickname as the opponent for the joiner
      if (payload.opponent) {
        localStorage.setItem(`opponentNickname_${payload.gameId}`, payload.opponent.nickname);
      }
      setLoading(false);
      navigate(`/lobby/${joinCode}?gameId=${payload.gameId}`);
    });

    const offError = on(ServerEvents.ERROR, (payload) => {
      setError(payload.message);
      setLoading(false);
    });

    return () => {
      offCreated();
      offJoined();
      offError();
    };
  }, [on, navigate, joinCode]);

  const handleCreate = () => {
    if (!nickname.trim()) {
      setError('NICKNAME REQUIRED');
      return;
    }
    setError('');
    setLoading(true);
    emit(ClientEvents.LOBBY_CREATE, {
      nickname: nickname.trim().slice(0, 30),
      settings: { turns, category: category.toLowerCase() },
    });
  };

  const handleJoin = () => {
    if (!nickname.trim()) {
      setError('NICKNAME REQUIRED');
      return;
    }
    if (!joinCode.trim()) {
      setError('ROOM CODE REQUIRED');
      return;
    }
    setError('');
    setLoading(true);
    emit(ClientEvents.LOBBY_JOIN, {
      nickname: nickname.trim().slice(0, 30),
      roomCode: joinCode.trim().toUpperCase(),
    });
  };

  return (
    <>
      <ConnectionBanner status={status} />
      <DossierFrame page={1} totalPages={4}>
        <div style={{ padding: '18px 14px 0' }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: '#7a6f60',
              marginBottom: 4,
            }}
          >
            SECTION 0 — REQUISITION
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 30,
              lineHeight: 1.05,
              letterSpacing: -0.5,
            }}
          >
            BEGIN<br />INTERROGATION.
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#3a3530',
              marginTop: 8,
              maxWidth: 290,
            }}
          >
            Configure conditions of conversation. You are the case officer.
            Your counterpart will inherit these terms.
          </div>
        </div>

        <div style={{ padding: '16px 14px 0' }}>
          {/* Nickname field */}
          <div style={{ borderBottom: '0.5px dashed #1a1815', padding: '10px 0 12px' }}>
            <div style={{ fontSize: 9, letterSpacing: 1.2, color: '#7a6f60', fontWeight: 700, marginBottom: 7 }}>
              SUBJECT DESIGNATION (NICKNAME)
            </div>
            <input
              type="text"
              value={nickname}
              maxLength={30}
              placeholder="ENTER ALIAS…"
              onChange={(e) => setNickname(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: '1px solid #1a1815',
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: '#1a1815',
                fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                letterSpacing: 1,
                outline: 'none',
              }}
            />
            <div style={{ fontSize: 8.5, color: '#7a6f60', marginTop: 4, letterSpacing: 0.5 }}>
              {nickname.length}/30 CHARS
            </div>
          </div>

          <SelectRow
            label="TURNS PER SUBJECT"
            options={TURN_OPTIONS.map(String)}
            active={String(turns)}
            onSelect={(v) => setTurns(Number(v) as TurnOption)}
          />

          <SelectRow
            label="TOPIC CATEGORY"
            options={[...CATEGORY_OPTIONS]}
            active={category}
            onSelect={(v) => setCategory(v as CategoryOption)}
          />
        </div>

        <div style={{ position: 'absolute', top: 180, right: 10 }}>
          <Stamp rotate={4}>DRAFT</Stamp>
        </div>

        {error && (
          <div
            style={{
              margin: '8px 14px 0',
              padding: '6px 10px',
              border: '1px solid #a32118',
              color: '#a32118',
              fontSize: 9,
              letterSpacing: 1.5,
              fontWeight: 700,
            }}
          >
            ✕ {error}
          </div>
        )}

        {/* Toggle join mode */}
        {mode === 'join' && (
          <div style={{ padding: '10px 14px 0' }}>
            <div style={{ borderBottom: '0.5px dashed #1a1815', padding: '10px 0 12px' }}>
              <div style={{ fontSize: 9, letterSpacing: 1.2, color: '#7a6f60', fontWeight: 700, marginBottom: 7 }}>
                ROOM CODE
              </div>
              <input
                type="text"
                value={joinCode}
                maxLength={6}
                placeholder="XXXXXX"
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid #1a1815',
                  padding: '6px 10px',
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#1a1815',
                  fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                  letterSpacing: 4,
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            </div>
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            right: 0,
            padding: '0 14px',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {mode === 'create' ? (
              <>
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  style={{
                    flex: 1,
                    border: '1.5px solid #1a1815',
                    padding: '12px 14px',
                    background: loading ? '#7a6f60' : '#1a1815',
                    color: '#efe9dc',
                    textAlign: 'center',
                    letterSpacing: 2.5,
                    fontWeight: 800,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? '◌ DISPATCHING…' : '◆ AUTHORIZE & DISPATCH'}
                </button>
                <button
                  onClick={() => setMode('join')}
                  style={{
                    border: '1.5px solid #1a1815',
                    padding: '12px 14px',
                    background: 'transparent',
                    color: '#1a1815',
                    textAlign: 'center',
                    letterSpacing: 2,
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  JOIN ↵
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleJoin}
                  disabled={loading}
                  style={{
                    flex: 1,
                    border: '1.5px solid #1a1815',
                    padding: '12px 14px',
                    background: loading ? '#7a6f60' : '#1a1815',
                    color: '#efe9dc',
                    textAlign: 'center',
                    letterSpacing: 2.5,
                    fontWeight: 800,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? '◌ JOINING…' : '↵ JOIN ROOM'}
                </button>
                <button
                  onClick={() => { setMode('create'); setJoinCode(''); }}
                  style={{
                    border: '1.5px solid #1a1815',
                    padding: '12px 14px',
                    background: 'transparent',
                    color: '#1a1815',
                    textAlign: 'center',
                    letterSpacing: 2,
                    fontWeight: 700,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ← BACK
                </button>
              </>
            )}
          </div>
          <div
            style={{
              textAlign: 'center',
              marginTop: 8,
              fontSize: 9,
              color: '#7a6f60',
              letterSpacing: 1.5,
            }}
          >
            FILING NEW CASE — KEEP THIS FORM CONFIDENTIAL
          </div>
        </div>
      </DossierFrame>
    </>
  );
};

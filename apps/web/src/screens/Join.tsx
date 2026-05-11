import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DossierFrame, Stamp } from '../components/DossierFrame.js';
import { ConnectionBanner } from '../components/ConnectionBanner.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { ClientEvents, ServerEvents } from '@openclaw/shared';

export const Join: React.FC = () => {
  const { roomCode: roomCodeParam } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const roomCode = (roomCodeParam ?? '').toUpperCase().slice(0, 6);

  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { status, emit, on } = useGameSocket();

  useEffect(() => {
    const offJoined = on(ServerEvents.LOBBY_JOINED, (payload) => {
      localStorage.setItem(`session_${payload.gameId}`, payload.sessionToken);
      localStorage.setItem(`playerId_${payload.gameId}`, payload.playerId);
      localStorage.setItem(`nickname_${payload.gameId}`, nickname.trim());
      if (payload.opponent) {
        localStorage.setItem(
          `opponentNickname_${payload.gameId}`,
          payload.opponent.nickname,
        );
        localStorage.setItem(
          `opponentPlayerId_${payload.gameId}`,
          payload.opponent.playerId,
        );
      }
      setLoading(false);
      navigate(`/lobby/${payload.roomCode}?gameId=${payload.gameId}`);
    });

    const offError = on(ServerEvents.ERROR, (payload) => {
      setError(payload.message);
      setLoading(false);
    });

    return () => {
      offJoined();
      offError();
    };
  }, [on, navigate, nickname]);

  const handleJoin = () => {
    if (!nickname.trim()) {
      setError('NICKNAME REQUIRED');
      return;
    }
    if (roomCode.length !== 6) {
      setError('INVALID ROOM CODE');
      return;
    }
    setError('');
    setLoading(true);
    emit(ClientEvents.LOBBY_JOIN, {
      nickname: nickname.trim().slice(0, 30),
      roomCode,
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
            SECTION 0 — SUMMONS
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 30,
              lineHeight: 1.05,
              letterSpacing: -0.5,
            }}
          >
            REPORT FOR<br />INTERROGATION.
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#3a3530',
              marginTop: 8,
              maxWidth: 290,
            }}
          >
            A case officer has invited you to file {roomCode}. Provide your
            alias to enter the room.
          </div>
        </div>

        <div style={{ padding: '16px 14px 0' }}>
          <div
            style={{
              margin: '12px 0 0',
              border: '1.5px solid #1a1815',
              position: 'relative',
            }}
          >
            <div
              style={{
                background: '#1a1815',
                color: '#efe9dc',
                padding: '5px 8px',
                fontSize: 9,
                letterSpacing: 1.5,
              }}
            >
              ROOM CODE
            </div>
            <div
              style={{
                textAlign: 'center',
                padding: '14px 0 10px',
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: 8,
              }}
            >
              {roomCode || '------'}
            </div>
          </div>

          <div
            style={{ borderBottom: '0.5px dashed #1a1815', padding: '14px 0 12px' }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: 1.2,
                color: '#7a6f60',
                fontWeight: 700,
                marginBottom: 7,
              }}
            >
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
                fontFamily:
                  "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                letterSpacing: 1,
                outline: 'none',
              }}
            />
            <div
              style={{
                fontSize: 8.5,
                color: '#7a6f60',
                marginTop: 4,
                letterSpacing: 0.5,
              }}
            >
              {nickname.length}/30 CHARS
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', top: 180, right: 10 }}>
          <Stamp rotate={4}>INVITED</Stamp>
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

        <div
          style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            right: 0,
            padding: '0 14px',
          }}
        >
          <button
            onClick={handleJoin}
            disabled={loading}
            style={{
              width: '100%',
              border: '1.5px solid #1a1815',
              padding: '12px 14px',
              background: loading ? '#7a6f60' : '#1a1815',
              color: '#efe9dc',
              textAlign: 'center',
              letterSpacing: 2.5,
              fontWeight: 800,
              fontSize: 12,
              fontFamily:
                "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '◌ ATTACHING…' : '↵ ATTACH TO FILE'}
          </button>
          <div
            style={{
              textAlign: 'center',
              marginTop: 8,
              fontSize: 9,
              color: '#7a6f60',
              letterSpacing: 1.5,
            }}
          >
            BY ATTACHING, YOU CONSENT TO BE OBSERVED
          </div>
        </div>
      </DossierFrame>
    </>
  );
};

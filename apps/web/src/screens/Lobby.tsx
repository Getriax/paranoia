import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DossierFrame, FieldRow, Stamp } from '../components/DossierFrame.js';
import { ConnectionBanner } from '../components/ConnectionBanner.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { ServerEvents } from '@openclaw/shared';

export const Lobby: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId') ?? '';
  const navigate = useNavigate();

  const sessionToken = localStorage.getItem(`session_${gameId}`) ?? undefined;
  const myPlayerId = localStorage.getItem(`playerId_${gameId}`) ?? '';

  const { status, on } = useGameSocket(sessionToken);

  const [players, setPlayers] = useState<{ playerId: string; nickname: string }[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const offJoined = on(ServerEvents.LOBBY_PLAYER_JOINED, (payload) => {
      setPlayers(payload.players);
      // Persist opponent nickname for use in Play screen
      const opp = payload.players.find((p) => p.playerId !== myPlayerId);
      if (opp) {
        localStorage.setItem(`opponentNickname_${gameId}`, opp.nickname);
      }
      if (payload.players.length >= 2 && gameStarted) {
        navigate(`/play/${gameId}`);
      }
    });

    const offStarted = on(ServerEvents.GAME_STARTED, () => {
      setGameStarted(true);
      navigate(`/play/${gameId}`);
    });

    return () => {
      offJoined();
      offStarted();
    };
  }, [on, navigate, gameId, gameStarted, myPlayerId]);

  const handleCopy = async () => {
    const url = `${window.location.origin}/lobby/${roomCode ?? ''}?gameId=${gameId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: copy just the code
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const myNickname = players.find((p) => p.playerId === myPlayerId)?.nickname ?? '—';
  const opponentNickname =
    players.find((p) => p.playerId !== myPlayerId)?.nickname ?? null;

  return (
    <>
      <ConnectionBanner status={status} />
      <DossierFrame page={2} totalPages={4}>
        <div style={{ padding: '18px 14px 0' }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: '#7a6f60',
              marginBottom: 4,
            }}
          >
            SECTION I — INTAKE
          </div>
          <div
            style={{
              fontWeight: 800,
              fontSize: 30,
              lineHeight: 1.05,
              letterSpacing: -0.5,
              marginBottom: 2,
            }}
          >
            {opponentNickname ? (
              <>BOTH PARTIES<br />ATTACHED.</>
            ) : (
              <>AWAITING<br />SECOND<br />SUBJECT.</>
            )}
          </div>
          <div
            style={{
              fontSize: 10,
              color: '#3a3530',
              marginTop: 10,
              maxWidth: 280,
            }}
          >
            {opponentNickname
              ? 'File is ready. Game will begin automatically.'
              : 'Room established. Share the code below or send the invitation link. File opens when the second subject attaches.'}
          </div>
        </div>

        {/* Room code box */}
        <div
          style={{
            margin: '22px 14px 0',
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
            ROOM CODE / SUBJECT MAY READ ALOUD
          </div>
          <div
            style={{
              textAlign: 'center',
              padding: '18px 0 14px',
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: 8,
            }}
          >
            {roomCode ?? '------'}
          </div>
          <div
            style={{
              borderTop: '0.5px dashed #1a1815',
              padding: '6px 10px',
              fontSize: 9,
              color: '#7a6f60',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>
              {opponentNickname ? '● 2/2 ATTACHED' : '○ AWAITING SECOND SUBJECT'}
            </span>
            <span>AUTH · SECURE</span>
          </div>
        </div>

        {/* Subject registry */}
        <div style={{ padding: '18px 14px 0' }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: '#7a6f60',
              marginBottom: 6,
            }}
          >
            SUBJECT REGISTRY
          </div>
          <FieldRow label="Subject A" value={`${myNickname} · ready`} />
          <FieldRow
            label="Subject B"
            value={
              opponentNickname ? (
                `${opponentNickname} · ready`
              ) : (
                <span style={{ color: '#7a6f60', fontStyle: 'italic' }}>
                  —— pending arrival
                </span>
              )
            }
          />
          <FieldRow label="Game ID" value={gameId.slice(0, 8) + '…'} />
        </div>

        <div style={{ position: 'absolute', top: 200, right: 12 }}>
          {opponentNickname ? (
            <Stamp rotate={-8} color="#8a1c14">READY</Stamp>
          ) : (
            <Stamp rotate={6}>PROVISIONAL</Stamp>
          )}
        </div>

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
            onClick={handleCopy}
            style={{
              width: '100%',
              border: '1.5px solid #1a1815',
              padding: '12px 14px',
              background: '#1a1815',
              color: '#efe9dc',
              textAlign: 'center',
              letterSpacing: 3,
              fontWeight: 800,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
              cursor: 'pointer',
            }}
          >
            {copied ? '✓ LINK COPIED' : '◆ COPY LINK · INVITE'}
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
            OR FILE A NEW CASE · ↩ EXIT
          </div>
        </div>
      </DossierFrame>
    </>
  );
};

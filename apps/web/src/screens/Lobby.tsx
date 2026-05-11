import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DossierFrame, FieldRow, Stamp } from '../components/DossierFrame.js';
import { ConnectionBanner } from '../components/ConnectionBanner.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { ClientEvents, ServerEvents } from '@openclaw/shared';

interface PlayerSlot {
  playerId: string;
  nickname: string;
  ready: boolean;
}

export const Lobby: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('gameId') ?? '';
  const navigate = useNavigate();

  const sessionToken = localStorage.getItem(`session_${gameId}`) ?? undefined;
  const myPlayerId = localStorage.getItem(`playerId_${gameId}`) ?? '';
  const myNickname = localStorage.getItem(`nickname_${gameId}`) ?? '';
  const seededOpponentId =
    localStorage.getItem(`opponentPlayerId_${gameId}`) ?? '';
  const seededOpponentNickname =
    localStorage.getItem(`opponentNickname_${gameId}`) ?? '';

  const { status, emit, on } = useGameSocket(sessionToken);

  const initialPlayers = useMemo<PlayerSlot[]>(() => {
    const me: PlayerSlot | null = myPlayerId
      ? { playerId: myPlayerId, nickname: myNickname || 'YOU', ready: false }
      : null;
    const opp: PlayerSlot | null = seededOpponentId
      ? {
          playerId: seededOpponentId,
          nickname: seededOpponentNickname || 'OPPONENT',
          ready: false,
        }
      : null;
    return [me, opp].filter((p): p is PlayerSlot => p !== null);
  }, [myPlayerId, myNickname, seededOpponentId, seededOpponentNickname]);

  const [players, setPlayers] = useState<PlayerSlot[]>(initialPlayers);
  const [copied, setCopied] = useState(false);
  const [myReadyPending, setMyReadyPending] = useState(false);

  useEffect(() => {
    const offJoined = on(ServerEvents.LOBBY_PLAYER_JOINED, (payload) => {
      setPlayers(
        payload.players.map((p) => ({
          playerId: p.playerId,
          nickname: p.nickname,
          ready: p.ready,
        })),
      );
      const opp = payload.players.find((p) => p.playerId !== myPlayerId);
      if (opp) {
        localStorage.setItem(`opponentNickname_${gameId}`, opp.nickname);
        localStorage.setItem(`opponentPlayerId_${gameId}`, opp.playerId);
      }
    });

    const offReady = on(ServerEvents.LOBBY_PLAYER_READY, (payload) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === payload.playerId ? { ...p, ready: payload.ready } : p,
        ),
      );
    });

    const offStarted = on(ServerEvents.GAME_STARTED, (payload) => {
      navigate(`/play/${gameId}`, { state: payload });
    });

    return () => {
      offJoined();
      offReady();
      offStarted();
    };
  }, [on, navigate, gameId, myPlayerId]);

  const handleCopy = async () => {
    const url = `${window.location.origin}/join/${roomCode ?? ''}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore; we still show the visual cue
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const me = players.find((p) => p.playerId === myPlayerId);
  const opponent = players.find((p) => p.playerId !== myPlayerId);
  const meReady = me?.ready ?? false;
  const oppReady = opponent?.ready ?? false;
  const bothPresent = !!opponent;
  const canReady = bothPresent && !meReady && !myReadyPending;

  const handleReady = () => {
    if (!canReady) return;
    setMyReadyPending(true);
    emit(ClientEvents.LOBBY_READY, {});
  };

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
              fontSize: 28,
              lineHeight: 1.05,
              letterSpacing: -0.5,
              marginBottom: 2,
            }}
          >
            {bothPresent ? (
              <>
                BOTH PARTIES<br />ATTACHED.
              </>
            ) : (
              <>
                AWAITING<br />SECOND<br />SUBJECT.
              </>
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
            {bothPresent
              ? 'File is established. Both parties must STAMP READY to commence.'
              : 'Room established. Share the code below or send the invitation link. File opens when the second subject attaches.'}
          </div>
        </div>

        {/* Room code box */}
        <div
          style={{
            margin: '18px 14px 0',
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
              padding: '14px 0 10px',
              fontSize: 40,
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
              {bothPresent ? '● 2/2 ATTACHED' : '○ AWAITING SECOND SUBJECT'}
            </span>
            <span>AUTH · SECURE</span>
          </div>
        </div>

        {/* Subject registry */}
        <div style={{ padding: '14px 14px 0' }}>
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
          <FieldRow
            label="Subject A"
            value={
              <span>
                {me?.nickname ?? myNickname ?? '—'} ·{' '}
                <span style={{ color: meReady ? '#1a1815' : '#8a1c14', fontWeight: 700 }}>
                  {meReady ? 'READY' : 'STANDBY'}
                </span>
              </span>
            }
          />
          <FieldRow
            label="Subject B"
            value={
              opponent ? (
                <span>
                  {opponent.nickname} ·{' '}
                  <span
                    style={{ color: oppReady ? '#1a1815' : '#8a1c14', fontWeight: 700 }}
                  >
                    {oppReady ? 'READY' : 'STANDBY'}
                  </span>
                </span>
              ) : (
                <span style={{ color: '#7a6f60', fontStyle: 'italic' }}>
                  —— pending arrival
                </span>
              )
            }
          />
          <FieldRow label="Room" value={roomCode ?? '——'} />
        </div>

        <div style={{ position: 'absolute', top: 200, right: 12 }}>
          {meReady && oppReady ? (
            <Stamp rotate={-8} color="#8a1c14">
              READY
            </Stamp>
          ) : bothPresent ? (
            <Stamp rotate={6} color="#7a6f60">
              STAND BY
            </Stamp>
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
          {/* Primary: ready / copy depending on state */}
          {bothPresent ? (
            <button
              onClick={handleReady}
              disabled={!canReady}
              style={{
                width: '100%',
                border: '1.5px solid #1a1815',
                padding: '12px 14px',
                background: meReady ? '#7a6f60' : '#1a1815',
                color: '#efe9dc',
                textAlign: 'center',
                letterSpacing: 3,
                fontWeight: 800,
                fontSize: 13,
                fontFamily:
                  "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                cursor: canReady ? 'pointer' : 'not-allowed',
              }}
            >
              {meReady
                ? oppReady
                  ? '◆ COMMENCING…'
                  : '✓ READY · AWAITING OPPONENT'
                : '◆ STAMP READY'}
            </button>
          ) : (
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
                fontFamily:
                  "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ LINK COPIED' : '◆ COPY LINK · INVITE'}
            </button>
          )}
          <div
            style={{
              textAlign: 'center',
              marginTop: 8,
              fontSize: 9,
              color: '#7a6f60',
              letterSpacing: 1.5,
            }}
          >
            {bothPresent
              ? 'BOTH MUST STAMP READY — GAME COMMENCES AUTOMATICALLY'
              : 'SHARE LINK · OR HAVE THEM ENTER THE CODE'}
          </div>
        </div>
      </DossierFrame>
    </>
  );
};

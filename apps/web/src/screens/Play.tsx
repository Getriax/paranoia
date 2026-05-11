import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { DossierFrame, Stamp } from '../components/DossierFrame.js';
import { ConnectionBanner, OpponentDisconnectModal } from '../components/ConnectionBanner.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { ServerEvents, ClientEvents, type GameStartedPayload } from '@openclaw/shared';

type GameStatus = 'loading' | 'active' | 'voting';

interface Message {
  messageId: string;
  fromPlayerId: string;
  text: string;
  turnNumber: number;
}

interface VotingMessage {
  id: string;
  text: string;
  fromPlayerId: string;
  turnNumber: number;
}

// ─── Active chat sub-screen ─────────────────────────────────────────────────

interface ActiveChatProps {
  messages: Message[];
  myPlayerId: string;
  topic: string;
  turnNumber: number;
  totalTurns: number;
  isMyTurn: boolean;
  onSend: (text: string) => void;
  opponentNickname: string;
}

const ActiveChat: React.FC<ActiveChatProps> = ({
  messages,
  myPlayerId,
  topic,
  turnNumber,
  totalTurns,
  isMyTurn,
  onSend,
  opponentNickname,
}) => {
  const [text, setText] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!text.trim() || !isMyTurn) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <DossierFrame page={2} totalPages={4}>
      {/* topic chip */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #1a1815',
          background: '#e8e1d0',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            letterSpacing: 1.2,
            color: '#7a6f60',
            marginBottom: 4,
          }}
        >
          <span>SUBJ B · {opponentNickname.toUpperCase()}</span>
          <span>
            TURN {String(turnNumber).padStart(2, '0')}/{String(totalTurns).padStart(2, '0')}
          </span>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.35, color: '#1a1815', fontWeight: 500 }}>
          <span
            style={{
              color: '#7a6f60',
              fontWeight: 700,
              letterSpacing: 1,
              marginRight: 6,
            }}
          >
            TOPIC ↳
          </span>
          {topic}
        </div>
      </div>

      {/* bubble feed */}
      <div
        ref={feedRef}
        style={{
          padding: '10px 12px 0',
          overflowY: 'auto',
          flex: 1,
          paddingBottom: 130,
          maxHeight: 'calc(100dvh - 200px)',
        }}
      >
        {messages.map((msg, i) => {
          const mine = msg.fromPlayerId === myPlayerId;
          const isLast =
            i === messages.length - 1 ||
            messages[i + 1]?.fromPlayerId !== msg.fromPlayerId;

          return (
            <div
              key={msg.messageId}
              style={{
                display: 'flex',
                justifyContent: mine ? 'flex-end' : 'flex-start',
                marginTop: 2,
                marginBottom: isLast ? 4 : 1,
              }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: mine ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    background: mine ? '#1a1815' : '#e8e1d0',
                    color: mine ? '#efe9dc' : '#1a1815',
                    border: mine ? 'none' : '1px solid #1a1815',
                    padding: '8px 12px',
                    fontSize: 13.5,
                    lineHeight: 1.38,
                    fontWeight: 500,
                    borderRadius: 18,
                    borderBottomRightRadius: mine && isLast ? 4 : 18,
                    borderBottomLeftRadius: !mine && isLast ? 4 : 18,
                  }}
                >
                  {msg.text}
                </div>
                {isLast && (
                  <div
                    style={{
                      fontSize: 8.5,
                      letterSpacing: 1.5,
                      color: '#7a6f60',
                      marginTop: 4,
                      padding: '0 4px',
                    }}
                  >
                    {mine ? 'YOU' : opponentNickname.toUpperCase()} · T{msg.turnNumber}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!isMyTurn && messages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
            <div
              style={{
                background: '#e8e1d0',
                border: '1px solid #1a1815',
                padding: '8px 14px',
                borderRadius: 18,
                borderBottomLeftRadius: 4,
                display: 'flex',
                gap: 4,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`typing-dot${i > 0 ? ` typing-dot-${i + 1}` : ''}`}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: '#3a3530',
                    display: 'inline-block',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* compose footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: 0,
          right: 0,
          borderTop: '1.5px solid #1a1815',
          background: '#e8e1d0',
        }}
      >
        <div
          style={{
            padding: '4px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 8.5,
            letterSpacing: 1.5,
            color: isMyTurn ? '#8a1c14' : '#7a6f60',
            fontWeight: 700,
            borderBottom: '0.5px dashed #1a1815',
          }}
        >
          <span>{isMyTurn ? '● YOUR TURN — COMPOSE' : '◌ STANDBY — AWAITING'}</span>
          <span style={{ color: '#7a6f60' }}>{text.length} / 280</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 8,
            padding: '10px 12px',
          }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 280))}
            onKeyDown={handleKeyDown}
            disabled={!isMyTurn}
            placeholder={isMyTurn ? 'Type your message…' : 'STANDBY'}
            rows={2}
            style={{
              flex: 1,
              background: isMyTurn ? '#efe9dc' : '#e8e1d0',
              border: '1px solid #1a1815',
              padding: '9px 12px',
              minHeight: 18,
              borderRadius: 18,
              fontSize: 13,
              color: isMyTurn ? '#1a1815' : '#7a6f60',
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
              fontWeight: 500,
              resize: 'none',
              outline: 'none',
              cursor: isMyTurn ? 'text' : 'not-allowed',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!isMyTurn || !text.trim()}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: isMyTurn && text.trim() ? '#1a1815' : '#7a6f60',
              color: '#efe9dc',
              border: 'none',
              fontSize: 16,
              fontWeight: 700,
              cursor: isMyTurn && text.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </DossierFrame>
  );
};

// ─── Voting sub-screen ───────────────────────────────────────────────────────

interface VotingProps {
  messages: VotingMessage[];
  myPlayerId: string;
  opponentPlayerId: string;
  opponentNickname: string;
  opponentSubmitted: boolean;
  onSubmit: (votes: { messageId: string; guessedModified: boolean }[]) => void;
}

const Voting: React.FC<VotingProps> = ({
  messages,
  myPlayerId,
  opponentPlayerId,
  opponentNickname,
  opponentSubmitted,
  onSubmit,
}) => {
  // Only vote on the opponent's messages
  const opponentMessages = messages.filter((m) => m.fromPlayerId === opponentPlayerId);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggleFlag = (id: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit(
      opponentMessages.map((m) => ({
        messageId: m.id,
        guessedModified: flagged.has(m.id),
      })),
    );
  };

  return (
    <DossierFrame page={3} totalPages={4}>
      <div
        style={{
          padding: '12px 14px 6px',
          borderBottom: '1px solid #1a1815',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            letterSpacing: 1.2,
            color: '#7a6f60',
            marginBottom: 4,
          }}
        >
          <span>SECTION III — REVIEW</span>
          <span style={{ color: '#8a1c14', fontWeight: 700 }}>
            {flagged.size}/{opponentMessages.length} FLAGGED
          </span>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: -0.5,
            lineHeight: 1.1,
          }}
        >
          Mark each statement<br />
          by {opponentNickname.toUpperCase()} that you<br />
          suspect was altered.
        </div>
      </div>

      <div style={{ padding: '10px 14px 100px', overflowY: 'auto', maxHeight: 'calc(100dvh - 180px)' }}>
        {opponentMessages.map((msg, i) => {
          const isFlagged = flagged.has(msg.id);
          return (
            <div
              key={msg.id}
              style={{
                border: '1px solid #1a1815',
                background: isFlagged ? 'rgba(163,33,24,0.06)' : '#efe9dc',
                padding: '9px 11px',
                marginBottom: 8,
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 9,
                  color: '#7a6f60',
                  letterSpacing: 1,
                  marginBottom: 5,
                }}
              >
                <span>EXHIBIT {String(i + 1).padStart(2, '0')} · {opponentNickname.toUpperCase()}</span>
                <span>TURN {msg.turnNumber}</span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.42,
                  color: '#1a1815',
                  marginBottom: 8,
                }}
              >
                {msg.text}
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: 9, letterSpacing: 1.2 }}>
                <button
                  onClick={() => isFlagged && toggleFlag(msg.id)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    border: '1px solid #1a1815',
                    background: !isFlagged ? '#e8e1d0' : 'transparent',
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    color: '#1a1815',
                    cursor: 'pointer',
                  }}
                >
                  ☐ GENUINE
                </button>
                <button
                  onClick={() => toggleFlag(msg.id)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    border: '1.5px solid #8a1c14',
                    background: isFlagged ? '#8a1c14' : 'transparent',
                    color: isFlagged ? '#efe9dc' : '#8a1c14',
                    fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    cursor: 'pointer',
                  }}
                >
                  {isFlagged ? '▣ MODIFIED' : '☐ MODIFIED'}
                </button>
              </div>
              {isFlagged && (
                <div style={{ position: 'absolute', top: -8, right: 8 }}>
                  <Stamp rotate={-12} style={{ fontSize: 8, padding: '3px 6px' }}>
                    FLAGGED
                  </Stamp>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: 0,
          right: 0,
          borderTop: '1.5px solid #1a1815',
          background: '#e8e1d0',
          padding: '10px 14px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, fontSize: 9, color: '#7a6f60', letterSpacing: 1 }}>
          {opponentNickname.toUpperCase()}:{' '}
          <span style={{ color: opponentSubmitted ? '#1a1815' : '#8a1c14', fontWeight: 700 }}>
            {opponentSubmitted ? 'FILED ✓' : 'FILING…'}
          </span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitted}
          style={{
            border: '2px solid #1a1815',
            background: submitted ? '#7a6f60' : '#1a1815',
            color: '#efe9dc',
            padding: '8px 14px',
            fontSize: 11,
            letterSpacing: 2,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
            cursor: submitted ? 'not-allowed' : 'pointer',
          }}
        >
          {submitted ? 'FILED ✓' : 'SUBMIT FILING ▸'}
        </button>
      </div>
    </DossierFrame>
  );
};

// ─── Main Play screen ────────────────────────────────────────────────────────

export const Play: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const seededStart = (location.state as GameStartedPayload | null) ?? null;

  const sessionToken = localStorage.getItem(`session_${gameId ?? ''}`) ?? undefined;
  const myPlayerId = localStorage.getItem(`playerId_${gameId ?? ''}`) ?? '';

  const { status, emit, on } = useGameSocket(sessionToken);

  const [gameStatus, setGameStatus] = useState<GameStatus>(
    seededStart ? 'active' : 'loading',
  );
  const [topic, setTopic] = useState(seededStart?.topic ?? '');
  const [totalTurns, setTotalTurns] = useState(seededStart?.totalTurns ?? 6);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [isMyTurn, setIsMyTurn] = useState(
    seededStart ? seededStart.firstPlayerId === myPlayerId : false,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [votingMessages, setVotingMessages] = useState<VotingMessage[]>([]);
  const [opponentPlayerId, setOpponentPlayerId] = useState(
    localStorage.getItem(`opponentPlayerId_${gameId ?? ''}`) ?? '',
  );
  const [opponentNickname] = useState(
    localStorage.getItem(`opponentNickname_${gameId ?? ''}`) ?? 'OPPONENT',
  );
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [disconnectDeadline, setDisconnectDeadline] = useState<string | null>(null);

  const onSend = useCallback(
    (text: string) => {
      emit(ClientEvents.GAME_MESSAGE, { text });
      setIsMyTurn(false);
    },
    [emit],
  );

  const onVoteSubmit = useCallback(
    (votes: { messageId: string; guessedModified: boolean }[]) => {
      emit(ClientEvents.VOTE_SUBMIT, { votes });
    },
    [emit],
  );

  useEffect(() => {
    const offStarted = on(ServerEvents.GAME_STARTED, (payload) => {
      setTopic(payload.topic);
      setTotalTurns(payload.totalTurns);
      setIsMyTurn(payload.firstPlayerId === myPlayerId);
      setGameStatus('active');
    });

    const offReceived = on(ServerEvents.GAME_MESSAGE_RECEIVED, (payload) => {
      setMessages((prev) => [...prev, payload as Message]);
      if (payload.fromPlayerId !== myPlayerId && opponentPlayerId === '') {
        setOpponentPlayerId(payload.fromPlayerId);
      }
    });

    const offYourTurn = on(ServerEvents.GAME_YOUR_TURN, (payload) => {
      setCurrentTurn(payload.turnNumber);
      setIsMyTurn(true);
    });

    const offVoting = on(ServerEvents.GAME_VOTING_PHASE, (payload) => {
      setVotingMessages(payload.messages as VotingMessage[]);
      setGameStatus('voting');
      // derive opponent's playerId from messages not sent by me
      const opp = payload.messages.find((m) => m.fromPlayerId !== myPlayerId);
      if (opp) setOpponentPlayerId(opp.fromPlayerId);
    });

    const offOpponentVoting = on(ServerEvents.GAME_OPPONENT_VOTING, (payload) => {
      setOpponentSubmitted(payload.submitted);
    });

    const offResults = on(ServerEvents.GAME_RESULTS, () => {
      navigate(`/results/${gameId ?? ''}`);
    });

    const offDisconnected = on(ServerEvents.GAME_OPPONENT_DISCONNECTED, (payload) => {
      setDisconnectDeadline(payload.reconnectDeadline);
    });

    const offReconnected = on(ServerEvents.GAME_OPPONENT_RECONNECTED, () => {
      setDisconnectDeadline(null);
    });

    return () => {
      offStarted();
      offReceived();
      offYourTurn();
      offVoting();
      offOpponentVoting();
      offResults();
      offDisconnected();
      offReconnected();
    };
  }, [on, navigate, gameId, myPlayerId, opponentPlayerId]);

  return (
    <>
      <ConnectionBanner status={status} />
      {disconnectDeadline && (
        <OpponentDisconnectModal deadline={disconnectDeadline} />
      )}

      {gameStatus === 'loading' && (
        <DossierFrame page={2} totalPages={4}>
          <div
            style={{
              padding: '60px 14px',
              textAlign: 'center',
              fontSize: 11,
              letterSpacing: 2,
              color: '#7a6f60',
            }}
          >
            CONNECTING TO FILE…
          </div>
        </DossierFrame>
      )}

      {gameStatus === 'active' && (
        <ActiveChat
          messages={messages}
          myPlayerId={myPlayerId}
          topic={topic}
          turnNumber={currentTurn}
          totalTurns={totalTurns}
          isMyTurn={isMyTurn}
          onSend={onSend}
          opponentNickname={opponentNickname}
        />
      )}

      {gameStatus === 'voting' && (
        <Voting
          messages={votingMessages}
          myPlayerId={myPlayerId}
          opponentPlayerId={opponentPlayerId}
          opponentNickname={opponentNickname}
          opponentSubmitted={opponentSubmitted}
          onSubmit={onVoteSubmit}
        />
      )}
    </>
  );
};

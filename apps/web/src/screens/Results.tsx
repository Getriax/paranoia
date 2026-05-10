import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DossierFrame, Stamp } from '../components/DossierFrame.js';
import { ConnectionBanner } from '../components/ConnectionBanner.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import { ServerEvents, ClientEvents } from '@openclaw/shared';

// Locally-typed result message row (server sends z.array(z.any()))
interface ResultMessage {
  id: string;
  text: string;
  originalText?: string;
  fromPlayerId: string;
  turnNumber: number;
  wasModified: boolean;
  playerGuessedModified: boolean;
}

interface Diff {
  original: string;
  delivered: string;
}

const DiffRow: React.FC<Diff> = ({ original, delivered }) => (
  <div style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.45 }}>
    <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
      <span
        style={{
          width: 38,
          fontSize: 8,
          color: '#7a6f60',
          letterSpacing: 1,
          paddingTop: 2,
        }}
      >
        SENT
      </span>
      <span
        style={{
          flex: 1,
          color: '#3a3530',
          textDecoration: 'line-through',
          textDecorationColor: '#8a1c14',
        }}
      >
        {original}
      </span>
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      <span
        style={{
          width: 38,
          fontSize: 8,
          color: '#8a1c14',
          letterSpacing: 1,
          paddingTop: 2,
          fontWeight: 700,
        }}
      >
        DELIV
      </span>
      <span
        style={{
          flex: 1,
          color: '#1a1815',
          fontWeight: 600,
          background: 'rgba(163,33,24,0.10)',
          padding: '2px 4px',
          margin: '-2px -4px',
        }}
      >
        {delivered}
      </span>
    </div>
  </div>
);

interface ResultRowProps {
  idx: number;
  speaker: string;
  message: ResultMessage;
}

const ResultRow: React.FC<ResultRowProps> = ({ idx, speaker, message }) => {
  const correct =
    message.wasModified === message.playerGuessedModified;

  return (
    <div
      style={{
        borderBottom: '0.5px dashed #1a1815',
        padding: '9px 0',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 9,
          color: '#7a6f60',
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        <span>EX {String(idx).padStart(2, '0')} · {speaker}</span>
        <span>
          {message.wasModified ? (
            <span style={{ color: '#8a1c14', fontWeight: 700 }}>● ALTERED</span>
          ) : (
            <span>○ AS-WRITTEN</span>
          )}
          {' · '}
          {correct ? (
            <span style={{ fontWeight: 700 }}>✓ CALLED</span>
          ) : (
            <span style={{ color: '#7a6f60' }}>✗ MISSED</span>
          )}
        </span>
      </div>
      {message.wasModified && message.originalText ? (
        <DiffRow original={message.originalText} delivered={message.text} />
      ) : (
        <div style={{ fontSize: 11, lineHeight: 1.45, color: '#3a3530' }}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export const Results: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();

  const sessionToken = localStorage.getItem(`session_${gameId ?? ''}`) ?? undefined;
  const myPlayerId = localStorage.getItem(`playerId_${gameId ?? ''}`) ?? '';

  const { status, emit, on } = useGameSocket(sessionToken);

  const [resultMessages, setResultMessages] = useState<ResultMessage[]>([]);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  // Survey state
  const [rating, setRating] = useState(0);
  const [wouldReplay, setWouldReplay] = useState(false);
  const [comment, setComment] = useState('');
  const [surveySubmitted, setSurveySubmitted] = useState(false);

  useEffect(() => {
    const offResults = on(ServerEvents.GAME_RESULTS, (payload) => {
      setScore(payload.score);

      // Cast z.any() payload to our local type
      const msgs = (payload.messages as unknown[]).map((m) => {
        const raw = m as Record<string, unknown>;
        return {
          id: String(raw['id'] ?? raw['messageId'] ?? ''),
          text: String(raw['text'] ?? ''),
          originalText: raw['originalText'] != null ? String(raw['originalText']) : undefined,
          fromPlayerId: String(raw['fromPlayerId'] ?? ''),
          turnNumber: Number(raw['turnNumber'] ?? 0),
          wasModified: Boolean(raw['wasModified']),
          playerGuessedModified: Boolean(raw['playerGuessedModified']),
        } satisfies ResultMessage;
      });
      setResultMessages(msgs);
      setLoading(false);
    });

    return () => offResults();
  }, [on]);

  const handleSurvey = () => {
    if (surveySubmitted || rating === 0) return;
    emit(ClientEvents.SURVEY_SUBMIT, {
      rating,
      wouldReplay,
      comment: comment.trim() || undefined,
    });
    setSurveySubmitted(true);
  };

  const identified = resultMessages.filter(
    (m) => m.wasModified && m.playerGuessedModified,
  ).length;
  const totalModified = resultMessages.filter((m) => m.wasModified).length;

  return (
    <>
      <ConnectionBanner status={status} />
      <DossierFrame page={4} totalPages={4}>
        {/* header */}
        <div
          style={{
            padding: '14px 14px 8px',
            borderBottom: '1.5px solid #1a1815',
            position: 'relative',
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: 1.2,
              color: '#7a6f60',
              marginBottom: 4,
            }}
          >
            SECTION IV — DISPOSITION
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: -1,
                  lineHeight: 1,
                }}
              >
                {identified} of {totalModified}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#7a6f60',
                  marginTop: 4,
                  letterSpacing: 0.5,
                }}
              >
                alterations identified
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: -1,
                  lineHeight: 1,
                  color: '#8a1c14',
                }}
              >
                {score.toFixed(2)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: '#7a6f60',
                  marginTop: 4,
                  letterSpacing: 0.5,
                }}
              >
                composite reward
              </div>
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: 14,
              transform: 'rotate(2deg)',
            }}
          >
            <Stamp rotate={-8} color="#8a1c14">
              CASE CLOSED
            </Stamp>
          </div>
        </div>

        {/* message list */}
        <div
          style={{
            padding: '8px 14px',
            overflowY: 'auto',
            maxHeight: 'calc(100dvh - 360px)',
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '30px 0',
                fontSize: 9,
                letterSpacing: 2,
                color: '#7a6f60',
              }}
            >
              LOADING DISPOSITION…
            </div>
          ) : (
            resultMessages.map((msg, i) => (
              <ResultRow
                key={msg.id}
                idx={i + 1}
                speaker={msg.fromPlayerId === myPlayerId ? 'SUBJ A → B' : 'SUBJ B → A'}
                message={msg}
              />
            ))
          )}
        </div>

        {/* survey + footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: 0,
            right: 0,
            borderTop: '1.5px solid #1a1815',
            padding: '10px 14px',
            background: '#e8e1d0',
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: '#7a6f60',
              letterSpacing: 1.2,
              marginBottom: 6,
            }}
          >
            POST-FILE SURVEY
          </div>

          {/* Stars */}
          <div
            style={{
              display: 'flex',
              gap: 5,
              marginBottom: 8,
              fontSize: 18,
              letterSpacing: 2,
            }}
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 18,
                  color: star <= rating ? '#1a1815' : '#7a6f60',
                }}
              >
                {star <= rating ? '★' : '☆'}
              </button>
            ))}
          </div>

          {/* Replay checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 10,
              letterSpacing: 1,
              color: '#1a1815',
              marginBottom: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={wouldReplay}
              onChange={(e) => setWouldReplay(e.target.checked)}
              style={{ accentColor: '#1a1815', width: 14, height: 14 }}
            />
            WOULD REPLAY
          </label>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="OPTIONAL COMMENT…"
            rows={2}
            style={{
              width: '100%',
              background: '#efe9dc',
              border: '1px solid #1a1815',
              padding: '7px 10px',
              fontSize: 10,
              color: '#1a1815',
              fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
              resize: 'none',
              outline: 'none',
              marginBottom: 8,
            }}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleSurvey}
              disabled={surveySubmitted || rating === 0}
              style={{
                flex: 1,
                border: '2px solid #1a1815',
                background: surveySubmitted || rating === 0 ? '#7a6f60' : '#1a1815',
                color: '#efe9dc',
                padding: '8px 12px',
                fontSize: 10.5,
                letterSpacing: 2,
                fontWeight: 800,
                fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                cursor: surveySubmitted || rating === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {surveySubmitted ? '✓ SUBMITTED' : 'SUBMIT SURVEY'}
            </button>
            <button
              onClick={() => navigate('/')}
              style={{
                border: '2px solid #1a1815',
                background: '#1a1815',
                color: '#efe9dc',
                padding: '8px 12px',
                fontSize: 10.5,
                letterSpacing: 2,
                fontWeight: 800,
                fontFamily: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace",
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              OPEN NEW FILE ▸
            </button>
          </div>
        </div>
      </DossierFrame>
    </>
  );
};

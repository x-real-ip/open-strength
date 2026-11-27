import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CoachMessage } from '@shared/types.ts';
import { api } from '../api.ts';
import { useInfo } from '../App.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';

const PROMPTS = [
  'Analyseer mijn voortgang',
  'Welke oefeningen stagneren en wat moet ik veranderen?',
  'Train ik genoeg voor mijn doel?',
  'Leg mijn volgende gewichten uit',
  'Hoe zit het met mijn herstel en trainingsbelasting?',
];

/** Tiny markdown subset: **bold**, headings and bullet markers. */
function renderText(text: string): ReactNode {
  return text.split('\n').map((line, i) => {
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const content = heading ? heading[1] : line.replace(/^\s*[-*]\s+/, '• ');
    const parts = content.split(/(\*\*[^*]+\*\*)/g).map((p, j) => (p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p));
    return (
      <span key={i}>
        {heading ? <strong>{parts}</strong> : parts}
        {'\n'}
      </span>
    );
  });
}

export default function CoachPage() {
  const info = useInfo();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data, error, loading, reload, setData } = useLoad(() => api.coachMessages());
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const messages: CoachMessage[] = data?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  useEffect(() => {
    if (params.get('ask') === 'stall') {
      setText('Sommige oefeningen stagneren. Wat moet ik veranderen?');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const send = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    const optimistic: CoachMessage = { id: -1, role: 'user', content: trimmed, createdAt: new Date().toISOString() };
    setData({ messages: [...messages, optimistic] });
    try {
      const res = await api.sendCoach(trimmed);
      setData({ messages: [...messages, ...res.messages] });
    } catch (e) {
      setData({ messages });
      setText(trimmed);
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <main className="page" style={{ paddingBottom: 'calc(var(--nav-h) + 150px + var(--safe-b))' }}>
      <div className="page-head">
        <h1>Coach</h1>
        {messages.length > 0 && (
          <button
            className="link-btn small"
            onClick={async () => {
              if (!confirm('Het gesprek wissen?')) return;
              await api.clearCoach();
              setData({ messages: [] });
            }}
          >
            Wissen
          </button>
        )}
      </div>

      {messages.length === 0 && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            Vraag naar je voortgang, plateaus, herstel of je programma. De antwoorden zijn gebaseerd op de trainingen die je hebt gelogd.
          </p>
          <p className="faint small" style={{ margin: 0 }}>
            De coach legt gewichten uit maar verandert ze nooit; je volgende gewichten komen altijd uit je gelogde sets.
            {!info.aiConfigured && ' Er is geen AI ingesteld op de server, dus de coach toont alleen feiten uit je trainingen.'}
          </p>
        </div>
      )}

      <div className="chat">
        {messages.map((m) => (
          <div key={`${m.id}-${m.createdAt}`} className={`msg ${m.role}`}>
            {m.role === 'assistant' ? renderText(m.content) : m.content}
          </div>
        ))}
        {sending && (
          <div className="msg assistant" aria-label="De coach typt">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {lastAssistant && !sending && info.aiConfigured && (
          <button
            className="btn block"
            onClick={() => navigate(`/program?instructions=${encodeURIComponent(`Pas dit advies van de coach toe:\n${lastAssistant.content.slice(0, 1500)}`)}`)}
          >
            Programma aanpassen met dit advies
          </button>
        )}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <div style={{ maxWidth: 560, margin: '0 auto 8px' }}>
          <div className="prompts">
            {PROMPTS.map((p) => (
              <button key={p} onClick={() => void send(p)} disabled={sending}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={onSubmit}>
          <textarea
            className="textarea"
            rows={1}
            placeholder="Vraag het je coach"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
          />
          <button className="btn primary" disabled={sending || !text.trim()}>
            Versturen
          </button>
        </form>
      </div>
    </main>
  );
}

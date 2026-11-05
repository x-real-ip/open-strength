import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { CoachMessage } from '@shared/types.ts';
import { api } from '../api.ts';
import { useInfo } from '../App.tsx';
import { ErrorState, Loading, toast, useLoad } from '../components/ui.tsx';

const PROMPTS = [
  'Analyse my progress',
  'Which exercises are stalling and what should I change?',
  'Am I training enough for my goal?',
  'Explain my next weights',
  'How is my recovery and training load?',
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
      setText('Some exercises are stalling. What should I change?');
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
              if (!confirm('Clear the conversation?')) return;
              await api.clearCoach();
              setData({ messages: [] });
            }}
          >
            Clear
          </button>
        )}
      </div>

      {messages.length === 0 && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>
            Ask about your progress, plateaus, recovery or your program. Answers are based on the workouts you logged.
          </p>
          <p className="faint small" style={{ margin: 0 }}>
            The coach explains weights but never changes them; next weights always come from your logged sets.
            {!info.aiConfigured && ' AI is not configured on the server, so the coach shows your training facts only.'}
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
          <div className="msg assistant" aria-label="Coach is typing">
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
            onClick={() => navigate(`/program?instructions=${encodeURIComponent(`Apply this coaching advice:\n${lastAssistant.content.slice(0, 1500)}`)}`)}
          >
            Adjust program with this advice
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
            placeholder="Ask your coach"
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
            Send
          </button>
        </form>
      </div>
    </main>
  );
}

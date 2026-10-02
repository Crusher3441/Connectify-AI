import { useState } from 'react';
import styles from '../../../styles/sidebar.module.css';

export default function PollsPanel({ polls, decisions, isOwner, mySocketId, onCreatePoll, onVote, onAddDecision }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [decisionText, setDecisionText] = useState('');
  const [error, setError] = useState(null);

  const submitPoll = async (e) => {
    e.preventDefault();
    const res = await onCreatePoll(question, options); // ack comes back from the server
    if (res?.ok) { setQuestion(''); setOptions(['', '']); setError(null); }
    else setError(res?.message || 'Could not create poll');
  };

  return (
    <div>
      <p className={styles.panelTitle}>Polls</p>

      {isOwner && (
        <form className={styles.pollForm} onSubmit={submitPoll}>
          <input className={styles.chatInput} placeholder="Poll question"
                 value={question} maxLength={200}
                 onChange={(e) => setQuestion(e.target.value)} />
          {options.map((opt, i) => (
            <input key={i} className={styles.chatInput} placeholder={`Option ${i + 1}`}
                   value={opt} maxLength={80}
                   onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))} />
          ))}
          {options.length < 5 && (
            <button type="button" className={styles.linkBtn}
                    onClick={() => setOptions([...options, ''])}>+ add option</button>
          )}
          {error && <p className={styles.formError}>{error}</p>}
          <button className={styles.sendBtn} disabled={question.trim().length < 3}>Create poll</button>
        </form>
      )}

      {polls.length === 0 && !isOwner && <p className={styles.empty}>No polls yet</p>}
      {polls.slice().reverse().map((poll) => {
        const total = poll.options.reduce((n, o) => n + o.votes.length, 0);
        const myVote = poll.options.findIndex((o) => o.votes.includes(mySocketId));
        return (
          <div key={poll.id} className={styles.poll}>
            <p className={styles.pollQ}>{poll.question}</p>
            {poll.options.map((opt, i) => {
              const pct = total ? Math.round((opt.votes.length / total) * 100) : 0;
              return (
                <button key={i} className={styles.pollOption}
                        onClick={() => onVote(poll.id, i)}>
                  <span className={styles.pollBar} style={{ width: `${pct}%` }} />
                  <span className={styles.pollLabel}>
                    {myVote === i ? '🔵 ' : ''}{opt.text} · {pct}%
                  </span>
                </button>
              );
            })}
            <p className={styles.meta}>{total} vote{total === 1 ? '' : 's'} — click to vote or switch</p>
          </div>
        );
      })}

      <p className={styles.panelTitle}>Decisions</p>
      <div className={styles.chatForm}>
        <input className={styles.chatInput} placeholder="Log a decision…"
               value={decisionText} maxLength={300}
               onChange={(e) => setDecisionText(e.target.value)} />
        <button className={styles.sendBtn} disabled={!decisionText.trim()}
                onClick={() => { onAddDecision(decisionText.trim()); setDecisionText(''); }}>
          Add
        </button>
      </div>
      {decisions.length === 0 && <p className={styles.empty}>Nothing decided yet</p>}
      {decisions.slice().reverse().map((d) => (
        <div key={d.id} className={styles.decision}>
          <p className={styles.msgText}>{d.text}</p>
          <p className={styles.meta}>— {d.by}, {new Date(d.at).toLocaleTimeString()}</p>
        </div>
      ))}
    </div>
  );
}

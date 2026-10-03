// ⚠️ CORRECTION (H5 follow-up): useSearchParams needed for the ?code= deep link.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../utils/apiClient';
import PageHeader from '../components/PageHeader';
import styles from '../styles/pages.module.css';

// ⚠️ CORRECTION (M6): the original was
//   const barClass = (pct) => (pct >= 70 ? '' : pct >= 40 ? 'warn' : 'bad');
//   … className={`${styles.barFill} ${styles[barClass(p.percentage)]}`}
// For the >=70 case barClass returns '' and styles[''] is `undefined`, so the
// template literal interpolated the literal string "undefined" into the
// className — a junk class on every healthy participant's bar.
// A map of ALL THREE states keeps `styles[...]` defined for every branch.
const BAR_CLASS = { good: '', warn: 'warn', bad: 'bad' };
const barClass = (pct) => {
  const pctNum = Number(pct) || 0;           // guards a string-typed percentage
  if (pctNum >= 70) return BAR_CLASS.good;
  if (pctNum >= 40) return BAR_CLASS.warn;
  return BAR_CLASS.bad;
};

function AttendanceCard({ report, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState(null);      // { summary, actionItems } | null
  const [detailState, setDetailState] = useState('idle'); // idle|loading|ready|error

  const fetchDetail = () =>
    apiClient
      .get(`/transcripts/me/${report.meetingCode}`)
      .then((res) => { setDetail(res.data); setDetailState('ready'); })
      .catch(() => setDetailState('error')); // 404 = no transcript (thin meeting) — fine

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && detailState === 'idle') {
      setDetailState('loading');
      fetchDetail();
    }
  };

  // ⚠️ CORRECTION (H5 follow-up): a card that STARTS open (deep-linked via
  // ?code=) never runs `toggle`, so its detail was never fetched — it would
  // render an expanded card stuck on "Loading summary…" forever. Fetch on mount
  // when defaultOpen is set.
  useEffect(() => {
    if (!defaultOpen || detailState !== 'idle') return;
    setDetailState('loading');
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen, detailState, report.meetingCode]);

  // ⚠️ CORRECTION (M6): the original had no catch — a rejected PATCH (403 for a
  // participant who never enrolled, 401 from a rotated token, 500 from a DB
  // blip) produced an unhandled promise rejection: the console filled with red
  // and the chip silently reverted on the next render with no explanation.
  const [chipError, setChipError] = useState(null);

  const toggleStatus = async (item) => {
    const next = item.status === 'done' ? 'open' : 'done';
    try {
      const { data: updated } = await apiClient.patch(`/action-items/${item._id}`, { status: next });
      setChipError(null);
      // Replace from the PATCH response — the server is the truth (6A contract).
      setDetail((d) => ({
        ...d,
        actionItems: d.actionItems.map((a) => (a._id === updated._id ? updated : a)),
      }));
    } catch (err) {
      setChipError(err.response?.data?.message || 'Could not update the action item');
    }
  };

  const avg = report.participants.length
    ? Math.round(report.participants.reduce((n, p) => n + p.percentage, 0) / report.participants.length)
    : 0;

  return (
    <div className={styles.card}>
      <div className={`${styles.cardRow} ${styles.expandable}`} onClick={toggle}>
        <button className={styles.chevron}>{open ? '▾' : '▸'}</button>
        <span className={styles.code}>{report.meetingCode}</span>
        <span className={styles.grow} />
        <span className={styles.meta}>
          {report.participants.length} tracked · avg {avg}% ·{' '}
          {new Date(report.endedAt).toLocaleDateString([], { dateStyle: 'medium' })}
        </span>
      </div>

      {open && (
        <div className={styles.detail}>
          {/* ⚠️ CORRECTION (M6): `panelTitle` lives in sidebar.module.css, NOT
              pages.module.css — styles.panelTitle was always undefined and the
              `|| ''` fallback silently rendered an unstyled label. Use a class
              that actually exists in this stylesheet. */}
          <p className={styles.sectionLabel}>Presence</p>
          {report.participants.map((p) => (
            <div key={p.username} className={styles.partRow}>
              <span className={styles.partName}>{p.username}</span>
              <div className={styles.bar}>
                {/* ⚠️ CORRECTION (M6): filter(Boolean) so a missing class can
                    never interpolate the literal string "undefined". */}
                <div
                  className={[styles.barFill, styles[barClass(p.percentage)]]
                    .filter(Boolean).join(' ')}
                  style={{ width: `${Number(p.percentage) || 0}%` }}
                />
              </div>
              <span className={styles.partMeta}>
                {p.percentage}% ({p.verifiedChecks}/{p.totalChecks} checks)
              </span>
            </div>
          ))}
          {report.participants.length === 0 && (
            <p className={styles.meta}>Nobody enrolled in this meeting.</p>
          )}

          {chipError && <p className={styles.meta}>{chipError}</p>}

          {detailState === 'loading' && <p className={styles.meta}>Loading summary…</p>}
          {detailState === 'error' && (
            <p className={styles.meta}>No transcript summary was generated for this meeting.</p>
          )}

          {detailState === 'ready' && detail?.summary && (
            <>
              <p className={styles.summaryText}>{detail.summary.summary}</p>
              {detail.actionItems?.length > 0 && (
                <>
                  <p style={{ margin: '6px 0 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    Action items — click the chip to toggle done:
                  </p>
                  {detail.actionItems.map((item) => (
                    <div key={item._id} className={styles.actionItem}>
                      <button
                        className={`${styles.statusChip} ${styles[item.status] || ''}`}
                        onClick={() => toggleStatus(item)}
                      >
                        {item.status}
                      </button>
                      <span className={styles.grow}>
                        {item.task}
                        {item.assignedTo ? ` — ${item.assignedTo}` : ''}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttendanceHistoryPage() {
  const [state, setState] = useState('loading');
  const [reports, setReports] = useState([]);
  const [error, setError] = useState(null);

  // ⚠️ CORRECTION (H5 follow-up): the History page's "View report" button
  // navigates here as /attendance?code=<meetingCode>. Nothing read that
  // param, so clicking it landed on the generic list with the target meeting
  // collapsed and buried — the "fix" pointed nowhere useful. Read it and
  // auto-expand that card on arrival.
  const [searchParams] = useSearchParams();
  const focusCode = searchParams.get('code');

  const load = () => {
    setState('loading');
    setError(null);
    apiClient
      .get('/attendance/me')
      .then((res) => { setReports(res.data.items || []); setState('ready'); })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load attendance reports');
        setState('error');
      });
  };

  useEffect(load, []);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Attendance reports"
        subtitle="Face-verified presence for meetings you hosted. Click a card to expand."
      />

      {state === 'error' && (
        <div className={styles.errorBox}>
          <span>{error}</span>
          <button className={styles.smallBtn} onClick={load}>Retry</button>
        </div>
      )}
      {state === 'loading' && (<><div className={styles.skeleton} /><div className={styles.skeleton} /></>)}
      {state === 'ready' && reports.length === 0 && (
        <p className={styles.subtitle}>No attendance reports yet — host a meeting with face enrollment enabled.</p>
      )}
      {state === 'ready' && reports.map((r) => (
        <AttendanceCard key={r._id} report={r} defaultOpen={r.meetingCode === focusCode} />
      ))}
    </main>
  );
}

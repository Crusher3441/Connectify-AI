import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { apiClient } from '../utils/apiClient';
import { trendSeries, presenceBuckets, headlineStats } from '../utils/stats';
import PageHeader from '../components/PageHeader';
import styles from '../styles/pages.module.css';

// Hex literals: SVG presentation attributes don't resolve CSS variables
// reliably — mirror the :root tokens here and keep them in sync.
const COLORS = { good: '#2ecc71', mid: '#f39c12', low: '#e74c3c', line: '#6c5ce7' };

export default function AttendanceAnalyticsPage() {
  const [state, setState] = useState('loading');
  const [reports, setReports] = useState([]);
  const [openItems, setOpenItems] = useState([]);
  const [error, setError] = useState(null);

  const load = () => {
    setState('loading');
    setError(null);
    Promise.all([
      apiClient.get('/attendance/me'),
      apiClient.get('/action-items/me?status=open'),
    ])
      .then(([attRes, itemsRes]) => {
        setReports(attRes.data.items || []);
        setOpenItems(itemsRes.data.items || []);
        setState('ready');
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Could not load analytics');
        setState('error');
      });
  };

  useEffect(load, []);

  const stats = headlineStats(reports, openItems);
  const trend = trendSeries(reports);
  const buckets = presenceBuckets(reports);
  const hasData = reports.some((r) => r.participants?.length);

  return (
    <main className={styles.page}>
      <PageHeader
        title="Analytics"
        subtitle="Presence and follow-through across your hosted meetings."
      />

      {state === 'error' && (
        <div className={styles.errorBox}>
          <span>{error}</span>
          <button className={styles.smallBtn} onClick={load}>Retry</button>
        </div>
      )}
      {state === 'loading' && <div className={styles.skeleton} />}

      {state === 'ready' && !hasData && (
        <p className={styles.subtitle}>
          Host more meetings with face enrollment to unlock analytics.
        </p>
      )}

      {state === 'ready' && hasData && (
        <>
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.hosted}</div>
              <div className={styles.statLabel}>Meetings hosted</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.avgPresence ?? '—'}%</div>
              <div className={styles.statLabel}>Average presence</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.trackedPeople}</div>
              <div className={styles.statLabel}>People tracked</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.openActionItems}</div>
              <div className={styles.statLabel}>Open action items</div>
            </div>
          </div>

          <div className={styles.chartCard}>
            <h3>Average presence per meeting</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" stroke="#9aa0b0" />
                <YAxis domain={[0, 100]} stroke="#9aa0b0" unit="%" />
                <Tooltip
                  contentStyle={{ background: '#1a1d27', border: 'none', borderRadius: 10, color: '#e8eaf0' }}
                />
                <Line type="monotone" dataKey="presence" stroke={COLORS.line} strokeWidth={2}
                      dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {buckets.length > 0 && (
            <div className={styles.chartCard}>
              <h3>Presence distribution (every tracked participant)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={buckets} dataKey="value" nameKey="name"
                       innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {buckets.map((entry) => (
                      <Cell key={entry.name} fill={
                        entry.name === '90%+' ? COLORS.good :
                        entry.name === '70–89%' ? COLORS.mid : COLORS.low
                      } />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip
                    contentStyle={{ background: '#1a1d27', border: 'none', borderRadius: 10, color: '#e8eaf0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </main>
  );
}
// Pure aggregation — no React, no fetch. Testable with plain node.

export const meetingAverage = (report) => {
  if (!report.participants?.length) return null; // null → recharts skips the point
  const sum = report.participants.reduce((n, p) => n + (p.percentage || 0), 0);
  return Math.round(sum / report.participants.length);
};

// Oldest → newest for a left-to-right trend line.
export const trendSeries = (reports) =>
  reports
    .slice()
    .sort((a, b) => new Date(a.endedAt) - new Date(b.endedAt))
    .map((r) => ({
      date: new Date(r.endedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      presence: meetingAverage(r),
    }));

// Distribution of EVERY tracked participant across quality buckets.
export const presenceBuckets = (reports) => {
  const counts = { excellent: 0, good: 0, low: 0 };
  reports.forEach((r) =>
    (r.participants || []).forEach((p) => {
      if (p.percentage >= 90) counts.excellent += 1;
      else if (p.percentage >= 70) counts.good += 1;
      else counts.low += 1;
    })
  );
  return [
    { name: '90%+', value: counts.excellent },
    { name: '70–89%', value: counts.good },
    { name: '<70%', value: counts.low },
  ].filter((d) => d.value > 0); // zero-slices render as ugly slivers — drop them
};

export const headlineStats = (reports, openActionItems) => {
  const hosted = reports.length;
  const withData = reports.map(meetingAverage).filter((v) => v !== null);
  const avgPresence = withData.length
    ? Math.round(withData.reduce((a, b) => a + b, 0) / withData.length)
    : null;
  return {
    hosted,
    avgPresence,
    openActionItems: openActionItems.length,
    trackedPeople: new Set(reports.flatMap((r) => (r.participants || []).map((p) => p.username))).size,
  };
};
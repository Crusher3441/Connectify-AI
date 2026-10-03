import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Badge from '@mui/material/Badge';
import styles from '../../styles/sidebar.module.css';

// Tab ids are stable strings; Phase 5 adds 'transcript' + owner-only 'attendance'.
const TABS_BASE = [
  { id: 'chat', label: 'Chat' },
  { id: 'people', label: 'People' },
  { id: 'polls', label: 'Polls' },
  { id: 'transcript', label: 'Transcript' },  // Phase 5
];

// Props:
//   active / onChange — controlled tab state (owned by VideoMeet)
//   isOwner          — owner-only data (attendance) gets its own tab (Phase 5)
//   badges           — { chat: 3 } unread counts per tab id
//   panels           — { chat: <ChatPanel/>, people: <…>, polls: <…> }
export default function Sidebar({ active, onChange, isOwner = false, badges = {}, panels = {} }) {
  const tabs = isOwner ? [...TABS_BASE, { id: 'attendance', label: 'Attendance' }] : TABS_BASE;

  return (
    <aside className={styles.sidebar}>
      <Tabs
        value={active}
        onChange={(_, next) => onChange(next)}
        variant="fullWidth"
        className={styles.tabs}
      >
        {tabs.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            disableRipple
            label={
              <Badge color="error" badgeContent={badges[t.id] || 0} max={99}>
                {t.label}
              </Badge>
            }
          />
        ))}
      </Tabs>
      <div className={styles.panel}>{panels[active] || null}</div>
    </aside>
  );
}

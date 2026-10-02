import { useEffect, useRef } from 'react';

// Autoscroll-to-bottom while the user is already at the bottom.
// dep: whatever list content changes (array reference).
export const useAutoScroll = (dep) => {
  const ref = useRef(null);
  const stickRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [dep]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  return { ref, onScroll };
};
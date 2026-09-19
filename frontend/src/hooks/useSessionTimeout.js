import { useEffect, useRef, useState } from "react";

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_MS = 60 * 1000; // warn 1 minute before purge

// Auto-purges the session after inactivity. On timeout the caller (typically
// AuthContext.logout) clears the stored token; this hook only tracks activity
// and exposes a warning state for the countdown banner.
export const useSessionTimeout = ({ onTimeout, enabled = true } = {}) => {
  const [warning, setWarning] = useState(false);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return undefined;

    let purgeTimer;
    let warnTimer;

    const reset = (initial = false) => {
      clearTimeout(purgeTimer);
      clearTimeout(warnTimer);
      if (!initial) setWarning(false);
      warnTimer = setTimeout(() => setWarning(true), INACTIVITY_MS - WARNING_MS);
      purgeTimer = setTimeout(
        () => onTimeoutRef.current?.(),
        INACTIVITY_MS,
      );
    };

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    const handler = () => reset();

    events.forEach((event) =>
      window.addEventListener(event, handler, { passive: true }),
    );
    reset(true);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handler));
      clearTimeout(purgeTimer);
      clearTimeout(warnTimer);
    };
  }, [enabled]);

  return { warning };
};

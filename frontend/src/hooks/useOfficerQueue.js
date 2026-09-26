import { useEffect, useState } from "react";
import api from "../services/api.js";

// Officer queue fetch. scope="all" includes resolved/closed (for All Cases /
// Resolved / Analytics views); default is the active priority queue.
export const useOfficerQueue = (scope) => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const url = scope === "all" ? "/queue?scope=all" : "/queue";
    api
      .get(url)
      .then(({ data }) => {
        if (!cancelled) setQueue(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Queue fetch error", err);
        if (!cancelled) setError("Could not load the support queue.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  return { queue, loading, error };
};

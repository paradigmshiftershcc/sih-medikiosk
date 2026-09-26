import { useEffect, useState } from "react";
import api from "../services/api.js";

// Complainant's own cases. Single fetch shared by dashboard, list, updates.
export const useMyCases = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/cases")
      .then(({ data }) => {
        if (!cancelled) setCases(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to fetch cases:", err);
        if (!cancelled) setError("Could not load your support cases.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { cases, loading, error };
};

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ActingHodCandidate = {
  id: string;
  name: string;
  role: string;
};

type ActingHodStatusResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    candidates?: ActingHodCandidate[];
  };
};

export const ProposedActingHodField = ({
  name = "proposedActingHodId",
}: {
  name?: string;
}) => {
  const selectRef = useRef<HTMLSelectElement>(null);
  const [roleKey, setRoleKey] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [candidates, setCandidates] = useState<ActingHodCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHod = roleKey === "HOD";

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRoleKey(window.localStorage.getItem("lf-user-role"));
  }, []);

  useEffect(() => {
    if (!isHod) {
      setCandidates([]);
      setError(null);
      setValue("");
      return;
    }

    let isCancelled = false;

    const loadCandidates = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/leaves/acting-hod", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as ActingHodStatusResponse;

        if (!response.ok || !result.ok) {
          throw new Error(
            result.message ?? "Unable to load acting HoD candidates.",
          );
        }

        if (!isCancelled) {
          const next = result.data?.candidates ?? [];
          setCandidates(next);
          if (value && !next.some((candidate) => candidate.id === value)) {
            setValue("");
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setCandidates([]);
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load acting HoD candidates.",
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCandidates();

    return () => {
      isCancelled = true;
    };
  }, [isHod, value]);

  useEffect(() => {
    const select = selectRef.current;
    const form = select?.form;
    if (!form) return;

    const handleReset = () => setValue("");
    form.addEventListener("reset", handleReset);

    return () => {
      form.removeEventListener("reset", handleReset);
    };
  }, []);

  const helper = useMemo(() => {
    if (isLoading) return "Loading candidates...";
    if (error) return error;
    if (candidates.length === 0)
      return "No eligible candidate available right now.";
    return "Optional: propose an acting HoD. Final assignment follows approval rules.";
  }, [candidates.length, error, isLoading]);

  if (!isHod) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
      <label
        className="block text-sm font-medium text-slate-900"
        htmlFor={name}
      >
        Proposed Acting HoD (optional)
      </label>
      <select
        ref={selectRef}
        id={name}
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
        disabled={isLoading || candidates.length === 0}
      >
        <option value="">No proposal</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name} ({candidate.role})
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-slate-600">{helper}</p>
    </div>
  );
};

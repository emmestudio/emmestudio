"use client";
import { useEffect, useState } from "react";
export default function AssigneeField({
  email,
  name,
  onChange,
}: {
  email: string | null | undefined;
  name: string;
  onChange: (email: string | null, name: string) => void;
}) {
  const [people, setPeople] = useState<{ email: string; name: string }[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/team", { signal: c.signal, cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setPeople(d.people);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, []);
  return (
    <div>
      <label>
        Responsabile del team
        <select
          value={email ?? ""}
          onChange={(e) => {
            const p = people.find((p) => p.email === e.target.value);
            onChange(p?.email ?? null, p?.name ?? name);
          }}
        >
          <option value="">Non collegato a un account</option>
          {email && !people.some((p) => p.email === email) ? (
            <option value={email}>{name} · accesso non attivo</option>
          ) : null}
          {people.map((p) => (
            <option key={p.email} value={p.email}>
              {p.name} · {p.email}
            </option>
          ))}
        </select>
      </label>
      {!email ? (
        <label>
          Referente / gruppo (testo)
          <input
            maxLength={200}
            value={name}
            onChange={(e) => onChange(null, e.target.value)}
          />
        </label>
      ) : null}
      <p className="small">
        {error ||
          (!email
            ? "Collega un account per far comparire il lavoro nella vista personale."
            : "Assegnazione collegata all’account del team.")}
      </p>
    </div>
  );
}

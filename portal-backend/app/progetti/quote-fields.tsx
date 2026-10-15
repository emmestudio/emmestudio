"use client";
import {
  euro,
  lineTotal,
  quoteTotal,
  moneyInput,
  quoteStates,
  type QuoteDraft,
  type QuoteLine,
} from "@/lib/finance-data";
export default function QuoteFields({
  quote,
  setQuote,
  amount,
  setAmount,
}: {
  quote: QuoteDraft;
  setQuote: (q: QuoteDraft) => void;
  amount: string;
  setAmount: (v: string) => void;
}) {
  const items = quote.items ?? [];
  function setItems(next: QuoteLine[]) {
    const total = quoteTotal(next);
    setQuote({ ...quote, items: next, amount: total });
    setAmount((total / 100).toFixed(2));
  }
  return (
    <>
      <div className="form-grid">
        <label>
          Importo totale (€)
          <input
            required
            readOnly={items.length > 0}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Stato preventivo
          <select
            value={quote.status}
            onChange={(e) => setQuote({ ...quote, status: e.target.value })}
          >
            {quoteStates.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <h4>Voci del preventivo</h4>
      <p className="small">
        Quantità e tariffe determinano il totale. Puoi usare quantità decimali
        per le ore di registrazione.
      </p>
      {items.map((line, index) => (
        <div className="quote-line" key={index}>
          <label>
            Descrizione
            <input
              required
              maxLength={300}
              value={line.description}
              onChange={(e) =>
                setItems(
                  items.map((l, i) =>
                    i === index ? { ...l, description: e.target.value } : l,
                  ),
                )
              }
            />
          </label>
          <label>
            Quantità
            <input
              type="number"
              required
              min="0.01"
              max="10000"
              step="0.01"
              value={line.quantity / 100 || ""}
              onChange={(e) =>
                setItems(
                  items.map((l, i) =>
                    i === index
                      ? {
                          ...l,
                          quantity: Math.round(Number(e.target.value) * 100),
                        }
                      : l,
                  ),
                )
              }
            />
          </label>
          <label>
            Tariffa (€)
            <input
              type="number"
              required
              min="0"
              max="9999999.99"
              step="0.01"
              value={line.unitPrice / 100}
              onChange={(e) =>
                setItems(
                  items.map((l, i) =>
                    i === index
                      ? {
                          ...l,
                          unitPrice: Math.round(Number(e.target.value) * 100),
                        }
                      : l,
                  ),
                )
              }
            />
          </label>
          <span>{euro(lineTotal(line))}</span>
          <button
            type="button"
            className="text-button danger"
            onClick={() => setItems(items.filter((_, i) => i !== index))}
            aria-label={"Rimuovi voce " + (index + 1)}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={items.length >= 100}
        onClick={() => {
          let current = 0;
          try {
            current = moneyInput(amount);
          } catch {}
          setItems([
            ...items,
            {
              description: items.length ? "" : "Servizio",
              quantity: 100,
              unitPrice: items.length ? 0 : current,
            },
          ]);
        }}
      >
        + Voce
      </button>
      {quote.status === "Confermato" ? (
        <div className="form-grid">
          <label>
            Conferma registrata il
            <input
              type="date"
              value={quote.confirmedOn ?? ""}
              onChange={(e) =>
                setQuote({ ...quote, confirmedOn: e.target.value || null })
              }
            />
          </label>
          <label>
            Riferimento della conferma
            <input
              maxLength={2000}
              placeholder="Es. conferma via email / WhatsApp"
              value={quote.confirmationNote ?? ""}
              onChange={(e) =>
                setQuote({ ...quote, confirmationNote: e.target.value })
              }
            />
          </label>
        </div>
      ) : null}
      <label>
        Dettaglio e condizioni
        <textarea
          maxLength={5000}
          value={quote.notes}
          onChange={(e) => setQuote({ ...quote, notes: e.target.value })}
        />
      </label>
      <p className="small">
        Importi del preventivo concordato. Il portale non calcola imposte o
        fatture.
      </p>
    </>
  );
}

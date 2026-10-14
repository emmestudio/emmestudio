"use client";
export default function PrintButton() {
  return (
    <button className="button no-print" onClick={() => window.print()}>
      Stampa / Salva PDF
    </button>
  );
}

/**
 * Sahifa orqa foni — «aurora»: to‘rtta katta rangli nur sekin suzadi.
 * Faqat CSS animatsiyasi (transform) — JavaScript ishlamaydi, videokartaga yengil.
 */
const NURLAR = [
  { rang: "var(--blob-1)", olcham: "62vmax", chap: "-18vmax", yuqori: "-24vmax" },
  { rang: "var(--blob-2)", olcham: "52vmax", chap: "58vw", yuqori: "-20vmax" },
  { rang: "var(--blob-3)", olcham: "44vmax", chap: "28vw", yuqori: "55vh" },
  { rang: "var(--blob-4)", olcham: "40vmax", chap: "78vw", yuqori: "48vh" },
];

export function Backdrop() {
  return (
    <div className="page-backdrop" aria-hidden>
      {NURLAR.map((n, i) => (
        <span
          key={i}
          className="blob"
          style={{
            width: n.olcham,
            height: n.olcham,
            left: n.chap,
            top: n.yuqori,
            background: `radial-gradient(circle at 50% 50%, ${n.rang} 0%, color-mix(in oklab, ${n.rang} 45%, transparent) 30%, transparent 68%)`,
          }}
        />
      ))}
    </div>
  );
}

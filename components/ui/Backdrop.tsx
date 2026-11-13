"use client";

import { motion } from "framer-motion";

const BLOBS = [
  { color: "var(--s1)", size: 520, x: "-8%", y: "-12%", davomiylik: 26 },
  { color: "var(--s2)", size: 440, x: "72%", y: "-6%", davomiylik: 32 },
  { color: "var(--s3)", size: 380, x: "38%", y: "62%", davomiylik: 38 },
];

/** Sahifa orqa foni: sekin suzuvchi rangli dog‘lar. */
export function Backdrop() {
  return (
    <div className="page-backdrop" aria-hidden>
      {BLOBS.map((b, i) => (
        <motion.span
          key={i}
          className="blob"
          style={{ background: b.color, width: b.size, height: b.size, left: b.x, top: b.y }}
          animate={{
            x: [0, 40, -25, 0],
            y: [0, -30, 25, 0],
            scale: [1, 1.12, 0.95, 1],
          }}
          transition={{ duration: b.davomiylik, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

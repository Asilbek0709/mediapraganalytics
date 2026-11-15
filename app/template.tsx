/**
 * Sahifalar almashganda umumiy o‘tish animatsiyasi.
 * CSS animatsiyasi (framer emas): kontent JavaScript yuklanishini kutmasdan ko‘rinadi,
 * template har o‘tishda qayta o‘rnatiladi — animatsiya har safar boshlanadi.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="sahifa-kirish">{children}</div>;
}

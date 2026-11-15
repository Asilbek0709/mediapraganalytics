/** Sahifa yuklanayotganda: kontent shaklidagi miltillovchi bloklar (bo‘sh ekran o‘rniga). */
export default function Yuklanmoqda() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div>
        <div className="skeleton h-3 w-28" />
        <div className="skeleton mt-3 h-8 w-72 max-w-full" />
        <div className="skeleton mt-3 h-3 w-[30rem] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card !p-5">
            <div className="flex items-start justify-between">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-9 w-9 !rounded-[12px]" />
            </div>
            <div className="skeleton mt-3 h-8 w-20" />
            <div className="skeleton mt-3 h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="card">
            <div className="skeleton h-4 w-48" />
            <div className="skeleton mt-2 h-3 w-64 max-w-full" />
            <div className="mt-6 flex flex-col gap-3">
              {[78, 62, 90, 45, 70].map((w, j) => (
                <div key={j} className="skeleton h-4" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

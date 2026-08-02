export default function RentalsLoading() {
  return (
    <main className="page-container" aria-label="正在加载租赁管理">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 w-20 animate-pulse rounded-full bg-muted" />)}
      </div>
      <section className="surface" aria-hidden="true">
        <div className="surface-content grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className={`h-10 animate-pulse rounded-lg bg-muted ${index === 0 ? 'xl:col-span-2' : ''}`} />)}
        </div>
      </section>
      <div className="grid gap-3 md:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border bg-muted" />)}
      </div>
      <section className="data-shell" aria-hidden="true">
        <div className="h-20 animate-pulse bg-muted/50" />
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-20 animate-pulse border-t bg-card" />)}
      </section>
      <span className="sr-only">正在加载，请稍候</span>
    </main>
  )
}

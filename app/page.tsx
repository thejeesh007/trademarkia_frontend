export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Collaborative Spreadsheet
        </h1>
        <p className="mt-2 text-slate-600">
          Dashboard scaffold is ready. Next commit will wire document list and creation.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-slate-900">Status</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
          <li>Next.js App Router initialized</li>
          <li>TypeScript strict mode enabled</li>
          <li>Tailwind CSS configured</li>
          <li>Feature folders prepared for editor, presence, and formulas</li>
        </ul>
      </section>
    </main>
  );
}

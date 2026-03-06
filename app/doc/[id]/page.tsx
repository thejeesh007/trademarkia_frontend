import Link from "next/link";

type EditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentEditorPage({ params }: EditorPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Spreadsheet Editor</h1>
          <p className="mt-1 text-sm text-slate-600">Document ID: {id}</p>
        </div>

        <Link className="text-sm font-medium text-blue-700 hover:underline" href="/">
          Back to dashboard
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">
          Editor grid and realtime sync will be implemented in upcoming commits.
        </p>
      </section>
    </main>
  );
}

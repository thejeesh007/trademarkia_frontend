import { SheetEditor } from "@/components/grid/sheet-editor";

type EditorPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentEditorPage({ params }: EditorPageProps) {
  const { id } = await params;

  return <SheetEditor documentId={id} />;
}

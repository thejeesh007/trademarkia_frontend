"use client";

import Link from "next/link";
import { KeyboardEvent, useMemo, useRef, useState } from "react";

const ROW_COUNT = 40;
const COLUMN_COUNT = 20;

function toColumnLabel(index: number): string {
  let value = index + 1;
  let label = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

function cellId(row: number, column: number): string {
  return `${toColumnLabel(column)}${row + 1}`;
}

type SheetEditorProps = {
  documentId: string;
};

export function SheetEditor({ documentId }: SheetEditorProps) {
  const columns = useMemo(
    () => Array.from({ length: COLUMN_COUNT }, (_, index) => toColumnLabel(index)),
    []
  );
  const rows = useMemo(() => Array.from({ length: ROW_COUNT }, (_, index) => index + 1), []);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);

  function updateCell(id: string, nextValue: string) {
    setCellValues((prev) => ({ ...prev, [id]: nextValue }));
  }

  function focusCell(nextRow: number, nextColumn: number) {
    if (nextRow < 0 || nextRow >= ROW_COUNT || nextColumn < 0 || nextColumn >= COLUMN_COUNT) {
      return;
    }

    const nextId = cellId(nextRow, nextColumn);
    const element = inputRefs.current[nextId];
    if (element) {
      element.focus();
      element.select();
    }
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLInputElement>, row: number, column: number) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(row - 1, column);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCell(row + 1, column);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCell(row, column - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusCell(row, column + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      focusCell(row + 1, column);
      return;
    }

    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      focusCell(row, column + 1);
      return;
    }

    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      focusCell(row, column - 1);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col px-6 py-8">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Spreadsheet Editor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Document: <span className="font-medium text-slate-800">{documentId}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            Sync status: Local only
          </p>
          <Link className="text-sm font-medium text-blue-700 hover:underline" href="/">
            Back to dashboard
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 w-16 border border-slate-200 bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-600">
                  #
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="min-w-32 border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((rowValue, rowIndex) => (
                <tr key={rowValue}>
                  <th className="sticky left-0 z-10 w-16 border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-semibold text-slate-600">
                    {rowValue}
                  </th>

                  {columns.map((_, columnIndex) => {
                    const id = cellId(rowIndex, columnIndex);
                    const isActive = id === activeCell;

                    return (
                      <td key={id} className="border border-slate-200 p-0">
                        <input
                          ref={(element) => {
                            inputRefs.current[id] = element;
                          }}
                          className={`h-9 w-full border-0 px-2 text-sm outline-none ${
                            isActive ? "bg-blue-50" : "bg-white"
                          }`}
                          value={cellValues[id] ?? ""}
                          onFocus={() => setActiveCell(id)}
                          onChange={(event) => updateCell(id, event.target.value)}
                          onKeyDown={(event) => onCellKeyDown(event, rowIndex, columnIndex)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

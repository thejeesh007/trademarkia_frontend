"use client";

import Link from "next/link";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ActiveUsers } from "@/components/presence/active-users";
import { subscribeToAuthState } from "@/lib/firebase/auth";
import { subscribeToDocumentCells, upsertCellValue } from "@/lib/firebase/cells";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import { heartbeatPresence, removePresence, subscribeToPresence } from "@/lib/firebase/presence";
import { computeDisplayValues } from "@/lib/formula/engine";
import {
  readSessionIdentity,
  saveSessionIdentity,
  saveSessionIdentityFromAuth,
  SessionIdentity
} from "@/lib/realtime/identity";
import { ActiveUser, CellFormat } from "@/types/spreadsheet";

const ROW_COUNT = 40;
const COLUMN_COUNT = 20;
const MIN_COLUMN_WIDTH = 96;
const MIN_ROW_HEIGHT = 30;
const BASE_COLUMNS = Array.from({ length: COLUMN_COUNT }, (_, index) => index);
const BASE_ROWS = Array.from({ length: ROW_COUNT }, (_, index) => index);
const DEFAULT_FORMAT: CellFormat = {
  bold: false,
  italic: false,
  color: "#0f172a"
};

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

function cellId(baseRow: number, baseColumn: number): string {
  return `${toColumnLabel(baseColumn)}${baseRow + 1}`;
}

function moveItem(list: number[], fromIndex: number, toIndex: number): number[] {
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function csvEscape(value: string): string {
  const safe = value.replace(/"/g, '""');
  return /[",\n]/.test(safe) ? `"${safe}"` : safe;
}

type SheetEditorProps = {
  documentId: string;
};

type SaveStatus = "connecting" | "saved" | "saving" | "error";

export function SheetEditor({ documentId }: SheetEditorProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingLocalValues = useRef<Record<string, string>>({});
  const pendingLocalFormats = useRef<Record<string, CellFormat>>({});

  const [columnOrder, setColumnOrder] = useState<number[]>(() => [...BASE_COLUMNS]);
  const [rowOrder, setRowOrder] = useState<number[]>(() => [...BASE_ROWS]);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [draggingColumn, setDraggingColumn] = useState<number | null>(null);
  const [draggingRow, setDraggingRow] = useState<number | null>(null);

  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [cellFormats, setCellFormats] = useState<Record<string, CellFormat>>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("connecting");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<SessionIdentity | null>(null);
  const [identityName, setIdentityName] = useState("");
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const computedValues = useMemo(() => computeDisplayValues(cellValues), [cellValues]);

  useEffect(() => {
    const existing = readSessionIdentity();
    if (existing) {
      setIdentity(existing);
    }

    const unsubscribeAuth = subscribeToAuthState((user) => {
      if (!user) {
        return;
      }
      const next = saveSessionIdentityFromAuth(user.uid, user.displayName);
      setIdentity(next);
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig()) {
      setSaveStatus("error");
      setSaveError("Firebase env is missing. Add NEXT_PUBLIC_FIREBASE_* values.");
      return () => undefined;
    }

    const unsubscribe = subscribeToDocumentCells(
      documentId,
      (remoteCells) => {
        setCellValues({ ...remoteCells.values, ...pendingLocalValues.current });
        setCellFormats({ ...remoteCells.formats, ...pendingLocalFormats.current });
        setSaveStatus((prev) => (prev === "saving" ? prev : "saved"));
        setSaveError(null);
      },
      (error) => {
        setSaveStatus("error");
        setSaveError(error.message);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [documentId]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((timerId) => clearTimeout(timerId));
    };
  }, []);

  useEffect(() => {
    if (!identity) {
      return () => undefined;
    }

    const currentIdentity = identity;
    let isMounted = true;

    async function heartbeat() {
      try {
        await heartbeatPresence(documentId, currentIdentity);
      } catch {
        if (isMounted) {
          setSaveError((prev) => prev ?? "Presence heartbeat failed.");
        }
      }
    }

    void heartbeat();
    const intervalId = setInterval(() => {
      void heartbeat();
    }, 15_000);

    const unsubscribe = subscribeToPresence(
      documentId,
      (users) => {
        if (isMounted) {
          setActiveUsers(users);
        }
      },
      (error) => {
        if (isMounted) {
          setSaveError(error.message);
        }
      }
    );

    const onBeforeUnload = () => {
      void removePresence(documentId, currentIdentity.uid);
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      unsubscribe();
      window.removeEventListener("beforeunload", onBeforeUnload);
      void removePresence(documentId, currentIdentity.uid);
    };
  }, [documentId, identity]);

  function getColumnWidth(baseColumn: number): number {
    return columnWidths[baseColumn] ?? 128;
  }

  function getRowHeight(baseRow: number): number {
    return rowHeights[baseRow] ?? 36;
  }

  function getCellFormat(id: string): CellFormat {
    return cellFormats[id] ?? DEFAULT_FORMAT;
  }

  function schedulePersist(id: string, nextValue: string, nextFormat: CellFormat) {
    pendingLocalValues.current[id] = nextValue;
    pendingLocalFormats.current[id] = nextFormat;

    const existingTimer = saveTimers.current[id];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    saveTimers.current[id] = setTimeout(async () => {
      try {
        setSaveStatus("saving");
        setSaveError(null);
        await upsertCellValue(documentId, id, nextValue, nextFormat);
        delete pendingLocalValues.current[id];
        delete pendingLocalFormats.current[id];
        setSaveStatus("saved");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save cell.";
        setSaveStatus("error");
        setSaveError(message);
      }
    }, 250);
  }

  function updateCell(id: string, nextValue: string) {
    const nextFormat = getCellFormat(id);
    setCellValues((prev) => ({ ...prev, [id]: nextValue }));
    schedulePersist(id, nextValue, nextFormat);
  }

  function updateCellFormat(id: string, partial: Partial<CellFormat>) {
    const nextFormat: CellFormat = {
      ...getCellFormat(id),
      ...partial
    };

    setCellFormats((prev) => ({ ...prev, [id]: nextFormat }));
    schedulePersist(id, cellValues[id] ?? "", nextFormat);
  }

  function getVisibleCellId(visibleRow: number, visibleColumn: number): string | null {
    const baseRow = rowOrder[visibleRow];
    const baseColumn = columnOrder[visibleColumn];
    if (baseRow === undefined || baseColumn === undefined) {
      return null;
    }
    return cellId(baseRow, baseColumn);
  }

  function focusCell(visibleRow: number, visibleColumn: number) {
    if (
      visibleRow < 0 ||
      visibleRow >= rowOrder.length ||
      visibleColumn < 0 ||
      visibleColumn >= columnOrder.length
    ) {
      return;
    }

    const targetId = getVisibleCellId(visibleRow, visibleColumn);
    if (!targetId) {
      return;
    }

    const element = inputRefs.current[targetId];
    if (element) {
      element.focus();
      element.select();
    }
  }

  function onCellKeyDown(event: KeyboardEvent<HTMLInputElement>, visibleRow: number, visibleColumn: number) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusCell(visibleRow - 1, visibleColumn);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusCell(visibleRow + 1, visibleColumn);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCell(visibleRow, visibleColumn - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusCell(visibleRow, visibleColumn + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      focusCell(visibleRow + 1, visibleColumn);
      return;
    }

    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault();
      focusCell(visibleRow, visibleColumn + 1);
      return;
    }

    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault();
      focusCell(visibleRow, visibleColumn - 1);
    }
  }

  function reorderColumn(targetBaseColumn: number) {
    if (draggingColumn === null || draggingColumn === targetBaseColumn) {
      return;
    }

    setColumnOrder((prev) => {
      const from = prev.indexOf(draggingColumn);
      const to = prev.indexOf(targetBaseColumn);
      if (from < 0 || to < 0) {
        return prev;
      }
      return moveItem(prev, from, to);
    });
  }

  function reorderRow(targetBaseRow: number) {
    if (draggingRow === null || draggingRow === targetBaseRow) {
      return;
    }

    setRowOrder((prev) => {
      const from = prev.indexOf(draggingRow);
      const to = prev.indexOf(targetBaseRow);
      if (from < 0 || to < 0) {
        return prev;
      }
      return moveItem(prev, from, to);
    });
  }

  function startColumnResize(event: React.MouseEvent<HTMLSpanElement>, baseColumn: number) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = getColumnWidth(baseColumn);

    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX);
      setColumnWidths((prev) => ({ ...prev, [baseColumn]: nextWidth }));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startRowResize(event: React.MouseEvent<HTMLSpanElement>, baseRow: number) {
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = getRowHeight(baseRow);

    const onMove = (moveEvent: MouseEvent) => {
      const nextHeight = Math.max(MIN_ROW_HEIGHT, startHeight + moveEvent.clientY - startY);
      setRowHeights((prev) => ({ ...prev, [baseRow]: nextHeight }));
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function exportAsCsv() {
    const lines: string[] = [];
    lines.push(columnOrder.map((baseColumn) => csvEscape(toColumnLabel(baseColumn))).join(","));

    rowOrder.forEach((baseRow) => {
      const values = columnOrder.map((baseColumn) => {
        const id = cellId(baseRow, baseColumn);
        return csvEscape(computedValues[id] ?? cellValues[id] ?? "");
      });
      lines.push(values.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function statusLabel(): string {
    if (saveStatus === "connecting") {
      return "Sync status: Connecting...";
    }
    if (saveStatus === "saving") {
      return "Sync status: Saving...";
    }
    if (saveStatus === "error") {
      return "Sync status: Error";
    }
    return "Sync status: Saved";
  }

  function statusClassName(): string {
    if (saveStatus === "saving" || saveStatus === "connecting") {
      return "border-amber-300 bg-amber-50 text-amber-800";
    }
    if (saveStatus === "error") {
      return "border-rose-300 bg-rose-50 text-rose-800";
    }
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }

  const activeCellRawValue = activeCell ? cellValues[activeCell] ?? "" : "";
  const activeCellFormat = activeCell ? getCellFormat(activeCell) : DEFAULT_FORMAT;

  function submitIdentity() {
    if (!identityName.trim()) {
      return;
    }
    const next = saveSessionIdentity(identityName);
    setIdentity(next);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col px-6 py-8">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Spreadsheet Editor</h1>
          <p className="mt-1 text-sm text-slate-600">
            Document: <span className="font-medium text-slate-800">{documentId}</span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <ActiveUsers users={activeUsers} currentUid={identity?.uid ?? null} />
          <p className={`rounded-md border px-3 py-1 text-xs font-medium ${statusClassName()}`}>
            {statusLabel()}
          </p>
          <Link className="text-sm font-medium text-blue-700 hover:underline" href="/">
            Back to dashboard
          </Link>
        </div>
      </header>

      {saveError ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {saveError}
        </p>
      ) : null}

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            {activeCell ? `Cell ${activeCell}` : "Select a cell"}
          </div>

          <input
            className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring disabled:bg-slate-100"
            placeholder="Type value or formula (e.g. =SUM(A1:A5))"
            value={activeCellRawValue}
            onChange={(event) => {
              if (!activeCell) {
                return;
              }
              updateCell(activeCell, event.target.value);
            }}
            disabled={!activeCell}
          />

          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${
              activeCellFormat.bold ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
            }`}
            disabled={!activeCell}
            onClick={() => {
              if (activeCell) {
                updateCellFormat(activeCell, { bold: !activeCellFormat.bold });
              }
            }}
          >
            Bold
          </button>

          <button
            type="button"
            className={`rounded-md border px-3 py-2 text-xs font-semibold ${
              activeCellFormat.italic
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-700"
            }`}
            disabled={!activeCell}
            onClick={() => {
              if (activeCell) {
                updateCellFormat(activeCell, { italic: !activeCellFormat.italic });
              }
            }}
          >
            Italic
          </button>

          <label className="flex items-center gap-2 rounded-md border border-slate-300 px-2 py-2 text-xs font-medium text-slate-700">
            Color
            <input
              type="color"
              value={activeCellFormat.color}
              disabled={!activeCell}
              onChange={(event) => {
                if (activeCell) {
                  updateCellFormat(activeCell, { color: event.target.value });
                }
              }}
            />
          </label>

          <button
            type="button"
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700"
            onClick={exportAsCsv}
          >
            Export CSV
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Drag headers to reorder. Drag header edges to resize rows/columns.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="sticky left-0 z-20 w-16 border border-slate-200 bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-600">
                  #
                </th>
                {columnOrder.map((baseColumn) => (
                  <th
                    key={`col_${baseColumn}`}
                    draggable
                    onDragStart={() => setDraggingColumn(baseColumn)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      reorderColumn(baseColumn);
                      setDraggingColumn(null);
                    }}
                    onDragEnd={() => setDraggingColumn(null)}
                    className="relative border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600"
                    style={{ width: `${getColumnWidth(baseColumn)}px`, minWidth: `${getColumnWidth(baseColumn)}px` }}
                  >
                    <span className="cursor-move select-none">{toColumnLabel(baseColumn)}</span>
                    <span
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-blue-300"
                      onMouseDown={(event) => startColumnResize(event, baseColumn)}
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rowOrder.map((baseRow, visibleRowIndex) => (
                <tr key={`row_${baseRow}`} style={{ height: `${getRowHeight(baseRow)}px` }}>
                  <th
                    draggable
                    onDragStart={() => setDraggingRow(baseRow)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      reorderRow(baseRow);
                      setDraggingRow(null);
                    }}
                    onDragEnd={() => setDraggingRow(null)}
                    className="sticky left-0 z-10 relative w-16 border border-slate-200 bg-slate-50 px-2 py-1 text-center text-xs font-semibold text-slate-600"
                  >
                    <span className="cursor-move select-none">{baseRow + 1}</span>
                    <span
                      className="absolute bottom-0 left-0 h-1.5 w-full cursor-row-resize bg-transparent hover:bg-blue-300"
                      onMouseDown={(event) => startRowResize(event, baseRow)}
                    />
                  </th>

                  {columnOrder.map((baseColumn, visibleColumnIndex) => {
                    const id = cellId(baseRow, baseColumn);
                    const isActive = id === activeCell;
                    const inputValue = isActive ? cellValues[id] ?? "" : computedValues[id] ?? cellValues[id] ?? "";
                    const format = getCellFormat(id);

                    return (
                      <td
                        key={id}
                        className="border border-slate-200 p-0"
                        style={{ width: `${getColumnWidth(baseColumn)}px`, minWidth: `${getColumnWidth(baseColumn)}px` }}
                      >
                        <input
                          ref={(element) => {
                            inputRefs.current[id] = element;
                          }}
                          className={`w-full border-0 px-2 text-sm outline-none ${isActive ? "bg-blue-50" : "bg-white"}`}
                          style={{
                            height: `${Math.max(getRowHeight(baseRow) - 2, MIN_ROW_HEIGHT - 2)}px`,
                            fontWeight: format.bold ? 700 : 400,
                            fontStyle: format.italic ? "italic" : "normal",
                            color: format.color
                          }}
                          value={inputValue}
                          onFocus={() => setActiveCell(id)}
                          onBlur={() => setActiveCell(null)}
                          onChange={(event) => updateCell(id, event.target.value)}
                          onKeyDown={(event) => onCellKeyDown(event, visibleRowIndex, visibleColumnIndex)}
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

      {!identity ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/35 p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Set Your Display Name</h2>
            <p className="mt-1 text-sm text-slate-600">
              This name and color will be visible to collaborators in this document.
            </p>

            <div className="mt-4 flex gap-2">
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
                placeholder="Enter display name"
                value={identityName}
                onChange={(event) => setIdentityName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitIdentity();
                  }
                }}
              />
              <button
                type="button"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={!identityName.trim()}
                onClick={submitIdentity}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

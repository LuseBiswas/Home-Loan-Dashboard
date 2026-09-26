"use client";

import { FormEvent, useRef, useState } from "react";
import { FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { periodLabel } from "@/lib/amortization";
import {
  DOCUMENT_CATEGORIES, DocumentCategory, DocumentDetails, LoanDocument, updateDocument, uploadDocument, validateDocumentFile,
} from "@/lib/document-service";
import { cn } from "@/lib/utils";
import { useDemoMode } from "@/lib/demo";
import { DemoNote } from "@/components/demo-note";

const selectClassName = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type DocumentFormTarget =
  | { mode: "upload"; category?: DocumentCategory; financialYear?: number }
  | { mode: "edit"; document: LoanDocument };

function fyRange(year: number) {
  return { start: `${year}-04-01`, end: `${year + 1}-03-31` };
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type DocumentFormDialogProps = {
  target: DocumentFormTarget | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  loanId: string;
  financialYears: number[];
  defaultFinancialYear: number;
};

export function DocumentFormDialog({ target, onClose, onSaved, ...props }: DocumentFormDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-[#dce5e2] bg-white text-[#10201d] sm:max-w-lg">
        {target ? <DocumentForm key={target.mode === "edit" ? target.document.id : `${target.category}-${target.financialYear}`} target={target} onClose={onClose} onSaved={onSaved} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DocumentForm({ target, onClose, onSaved, userId, loanId, financialYears, defaultFinancialYear }: Omit<DocumentFormDialogProps, "target"> & { target: DocumentFormTarget }) {
  const editing = target.mode === "edit" ? target.document : null;
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>(editing?.category ?? (target.mode === "upload" ? target.category : undefined) ?? "sanction_letter");
  const [fileName, setFileName] = useState(editing?.file_name ?? "");
  const [financialYear, setFinancialYear] = useState(() => {
    const date = editing?.statement_period_start;
    if (date) return Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 4 ? 1 : 0);
    return (target.mode === "upload" ? target.financialYear : undefined) ?? defaultFinancialYear;
  });
  const [rangeStart, setRangeStart] = useState(editing?.statement_period_start ?? "");
  const [rangeEnd, setRangeEnd] = useState(editing?.statement_period_end ?? "");
  const [busy, setBusy] = useState(false);
  const demo = useDemoMode();
  const [error, setError] = useState<string | null>(null);

  const period = DOCUMENT_CATEGORIES.find((item) => item.value === category)?.period ?? null;
  const years = financialYears.includes(financialYear) ? financialYears : [...financialYears, financialYear].sort((a, b) => a - b);

  function pick(next: File | undefined) {
    if (!next) return;
    const invalid = validateDocumentFile(next);
    setError(invalid);
    if (invalid) return;
    setFile(next);
    if (!fileName) setFileName(next.name);
  }

  function details(): DocumentDetails {
    if (period === "fy") {
      const range = fyRange(financialYear);
      return { category, fileName, periodStart: range.start, periodEnd: range.end };
    }
    if (period === "range") return { category, fileName, periodStart: rangeStart || null, periodEnd: rangeEnd || null };
    return { category, fileName, periodStart: null, periodEnd: null };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !file) {
      setError("Choose a file to upload.");
      return;
    }
    if (period === "range" && rangeStart && rangeEnd && rangeEnd < rangeStart) {
      setError("The period end must be after its start.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (editing) await updateDocument(editing.id, details());
      else await uploadDocument({ userId, loanId, file: file!, details: details() });
      onSaved();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit document" : "Upload a document"}</DialogTitle>
        <DialogDescription>{editing ? "Rename it or change its category." : "PDF or image, up to 10 MB. Stored privately in your account."}</DialogDescription>
      </DialogHeader>

      <form onSubmit={submit} className="space-y-4">
        {editing ? null : (
          <label
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files[0]); }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition",
              dragging ? "border-[#0f766e] bg-[#f3faf7]" : "border-[#dce5e2] hover:border-[#9fd3c5] hover:bg-[#f7faf9]",
            )}
          >
            <FileUp className="size-6 text-[#0f766e]" aria-hidden="true" />
            {file ? (
              <>
                <span className="mt-2 max-w-full truncate text-sm font-semibold text-[#173d35]">{file.name}</span>
                <span className="text-xs text-[#6a7f79]">{formatSize(file.size)} · click to choose another</span>
              </>
            ) : (
              <>
                <span className="mt-2 text-sm font-semibold text-[#173d35]">Drop a file here, or click to choose</span>
                <span className="text-xs text-[#6a7f79]">PDF, PNG, JPEG or WebP</span>
              </>
            )}
            <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => pick(event.target.files?.[0])} />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)} className={selectClassName}>
              {DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm font-medium">
            <span className="block">Name</span>
            <Input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="e.g. Sanction letter 2026" required={Boolean(editing)} />
          </label>
        </div>

        {period === "fy" ? (
          <label className="block space-y-1.5 text-sm font-medium">
            <span className="block">Financial year</span>
            <select value={financialYear} onChange={(event) => setFinancialYear(Number(event.target.value))} className={selectClassName}>
              {years.map((year) => <option key={year} value={year}>{periodLabel(year, "financial")}</option>)}
            </select>
          </label>
        ) : null}

        {period === "range" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium"><span className="block">Period from <span className="font-normal text-[#6a7f79]">(optional)</span></span><Input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></label>
            <label className="space-y-1.5 text-sm font-medium"><span className="block">Period to <span className="font-normal text-[#6a7f79]">(optional)</span></span><Input type="date" value={rangeEnd} min={rangeStart || undefined} onChange={(event) => setRangeEnd(event.target.value)} /></label>
          </div>
        ) : null}

        {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {editing ? null : (
          <p className="flex items-start gap-2 text-xs leading-5 text-[#6a7f79]"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#0f766e]" />Loan papers include your name, address and account details. Only you can open them, through links that expire after a few minutes.</p>
        )}

        <DialogFooter className="sm:items-center">
          <DemoNote className="sm:mr-auto" />
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || demo} className="bg-[#173d35] text-white hover:bg-[#0d2824]">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {editing ? "Save changes" : "Upload"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

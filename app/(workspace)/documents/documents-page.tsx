"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, CircleDashed, Clock3, Download, ExternalLink, Eye, FileImage, FileText, LoaderCircle, Pencil, ShieldCheck, Trash2, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ContentLoading } from "@/components/loading-screen";
import { useWorkspace } from "@/components/workspace";
import { loanSchedule, periodLabel, periodStartYear } from "@/lib/amortization";
import { documentChecklist, ChecklistItem } from "@/lib/document-checklist";
import {
  categoryLabel, DOCUMENT_CATEGORIES, DocumentCategory, deleteDocument, documentUrl, listDocuments, LoanDocument,
} from "@/lib/document-service";
import { loadRateHistory } from "@/lib/loan-service";
import { useScheduleRevisions } from "@/lib/use-schedule-revisions";
import { cn } from "@/lib/utils";
import { DocumentFormDialog, DocumentFormTarget } from "./document-form-dialog";
import { useDemoMode } from "@/lib/demo";

const shortDate = (date: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(date.length === 10 ? `${date}T00:00:00` : date));

function todayIso() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function formatSize(bytes: number | null) {
  if (!bytes) return null;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function periodText(document: LoanDocument) {
  const { statement_period_start: start, statement_period_end: end } = document;
  if (document.category === "interest_certificate" && start) return periodLabel(periodStartYear(start, "financial"), "financial");
  if (start && end) return `${shortDate(start)} – ${shortDate(end)}`;
  if (start) return `From ${shortDate(start)}`;
  if (end) return `Until ${shortDate(end)}`;
  return null;
}

// Keeps the last loaded list so revisiting the page renders instantly while it refreshes.
const documentsCache = new Map<string, LoanDocument[]>();

export function DocumentsPage() {
  const { session, loan } = useWorkspace();
  const loanId = loan.id;
  const [documents, setDocuments] = useState<{ loanId: string; items: LoanDocument[] } | null>(() => {
    const cached = documentsCache.get(loan.id);
    return cached ? { loanId: loan.id, items: cached } : null;
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [rateRevisionCount, setRateRevisionCount] = useState(0);
  const { revisions } = useScheduleRevisions(loanId);
  const [filter, setFilter] = useState<DocumentCategory | "all">("all");
  const [formTarget, setFormTarget] = useState<DocumentFormTarget | null>(null);
  const [previewing, setPreviewing] = useState<LoanDocument | null>(null);
  const [deleting, setDeleting] = useState<LoanDocument | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listDocuments(loanId)
      .then((items) => {
        if (!active) return;
        documentsCache.set(loanId, items);
        setLoadError(null);
        setDocuments({ loanId, items });
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load your documents.");
      });
    return () => {
      active = false;
    };
  }, [loanId, refreshIndex]);

  useEffect(() => {
    let active = true;
    loadRateHistory(loanId)
      .then((rows) => {
        if (active) setRateRevisionCount(rows.filter((row) => row.notes?.startsWith("Rate revision recorded")).length);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [loanId]);

  const reload = useCallback(() => setRefreshIndex((value) => value + 1), []);
  const ready = documents?.loanId === loanId;
  const items = useMemo(() => (ready ? documents.items : []), [ready, documents]);
  const today = todayIso();
  const schedule = useMemo(() => loanSchedule(loan, Number(loan.current_interest_rate), revisions), [loan, revisions]);
  const checklist = useMemo(
    () => documentChecklist({ documents: items, schedule, today, prepaymentCount: revisions.length, rateRevisionCount }),
    [items, schedule, today, revisions.length, rateRevisionCount],
  );
  const financialYears = useMemo(
    () => [...new Set(schedule.filter((row) => row.dueDate <= addYear(today)).map((row) => periodStartYear(row.dueDate, "financial")))],
    [schedule, today],
  );
  const currentFinancialYear = periodStartYear(today, "financial");

  const visible = filter === "all" ? items : items.filter((document) => document.category === filter);
  const groups = DOCUMENT_CATEGORIES
    .map((category) => ({ ...category, documents: visible.filter((document) => document.category === category.value) }))
    .filter((group) => group.documents.length > 0);

  async function download(document: LoanDocument) {
    setActionError(null);
    try {
      window.location.assign(await documentUrl(document, { download: true }));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not open the document.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    try {
      await deleteDocument(deleting);
      reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not delete the document.");
    } finally {
      setDeleting(null);
    }
  }

  const header = (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-medium text-[#587069]">Documents</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] md:text-[2.15rem]">Your loan papers, in one safe place.</h1>
      </div>
      <Button className="bg-[#173d35] text-white hover:bg-[#0d2824]" onClick={() => setFormTarget({ mode: "upload" })}><Upload className="size-4" />Upload document</Button>
    </div>
  );

  const dialogs = (
    <>
      <DocumentFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={reload}
        userId={session.user.id}
        loanId={loanId}
        financialYears={financialYears}
        defaultFinancialYear={financialYears.includes(currentFinancialYear - 1) ? currentFinancialYear - 1 : currentFinancialYear}
      />
      <PreviewDialog document={previewing} onClose={() => setPreviewing(null)} onDownload={download} />
      <AlertDialog open={deleting !== null} onOpenChange={(next) => { if (!next) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleting?.file_name}&rdquo; will be permanently removed from your account. This can&apos;t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (loadError) return <>{header}<p className="mt-7 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">We couldn&apos;t load your documents. {loadError}</p></>;
  if (!ready) return <>{header}<ContentLoading label="Loading your documents…" /></>;

  return (
    <>
      {header}
      {dialogs}

      <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)] xl:items-start">
        <div className="min-w-0 space-y-4">
          {actionError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{actionError}</p> : null}

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={items.length} />
            {DOCUMENT_CATEGORIES.map((category) => {
              const total = items.filter((document) => document.category === category.value).length;
              return total > 0 ? <FilterChip key={category.value} active={filter === category.value} onClick={() => setFilter(category.value)} label={category.label} count={total} /> : null;
            })}
          </div>

          {items.length === 0 ? (
            <Card className="border-dashed border-[#cfe1dc] bg-white shadow-none">
              <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                <div className="grid size-12 place-items-center rounded-2xl bg-[#edf6f3] text-[#0f766e]"><FileText className="size-6" /></div>
                <p className="mt-4 font-semibold">No documents yet</p>
                <p className="mt-1 max-w-sm text-sm leading-6 text-[#6a7f79]">Start with your sanction and disbursement letters. The checklist shows what else to keep.</p>
                <Button className="mt-5 bg-[#173d35] text-white hover:bg-[#0d2824]" onClick={() => setFormTarget({ mode: "upload" })}><Upload className="size-4" />Upload your first document</Button>
              </CardContent>
            </Card>
          ) : (
            groups.map((group) => (
              <Card key={group.value} className="gap-0 border-[#dce5e2] bg-white py-0 shadow-none">
                <div className="flex items-center justify-between border-b border-[#eef3f1] px-5 py-3">
                  <p className="text-sm font-semibold">{group.label}</p>
                  <p className="text-xs text-[#6a7f79]">{group.documents.length} file{group.documents.length === 1 ? "" : "s"}</p>
                </div>
                <ul className="divide-y divide-[#eef3f1]">
                  {group.documents.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      onPreview={() => setPreviewing(document)}
                      onDownload={() => download(document)}
                      onEdit={() => setFormTarget({ mode: "edit", document })}
                      onDelete={() => setDeleting(document)}
                    />
                  ))}
                </ul>
              </Card>
            ))
          )}
        </div>

        <Checklist items={checklist} onUpload={(item) => setFormTarget({ mode: "upload", category: item.category, financialYear: item.financialYear })} />
      </div>
    </>
  );
}

function addYear(isoDate: string) {
  return `${Number(isoDate.slice(0, 4)) + 1}${isoDate.slice(4)}`;
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active ? "border-[#173d35] bg-[#173d35] text-white" : "border-[#dce5e2] bg-white text-[#4f6761] hover:border-[#9fd3c5]",
      )}
    >
      {label}<span className={cn("ml-1.5", active ? "text-[#c6d9d4]" : "text-[#789089]")}>{count}</span>
    </button>
  );
}

function DocumentRow({ document, onPreview, onDownload, onEdit, onDelete }: { document: LoanDocument; onPreview: () => void; onDownload: () => void; onEdit: () => void; onDelete: () => void }) {
  const demo = useDemoMode();
  const isImage = document.mime_type?.startsWith("image/");
  const Icon = isImage ? FileImage : FileText;
  const meta = [periodText(document), formatSize(document.file_size_bytes), `Added ${shortDate(document.uploaded_at)}`].filter(Boolean).join(" · ");

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <button type="button" onClick={onPreview} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf6f3] text-[#0f766e]"><Icon className="size-5" /></span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#173d35]" title={document.file_name}>{document.file_name}</span>
          <span className="block truncate text-xs text-[#6a7f79]">{meta}</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton label={`Preview ${document.file_name}`} onClick={onPreview}><Eye /></IconButton>
        <IconButton label={`Download ${document.file_name}`} onClick={onDownload}><Download /></IconButton>
        <IconButton label={`Edit ${document.file_name}`} onClick={onEdit}><Pencil /></IconButton>
        <IconButton label={`Delete ${document.file_name}`} onClick={onDelete} destructive disabled={demo}><Trash2 /></IconButton>
      </div>
    </li>
  );
}

function IconButton({ label, onClick, destructive = false, disabled = false, children }: { label: string; onClick: () => void; destructive?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label.split(" ")[0]} onClick={onClick} disabled={disabled} className={cn("text-[#587069]", destructive ? "hover:bg-red-50 hover:text-red-700" : "hover:bg-[#edf6f3] hover:text-[#173d35]")}>
      {children}
    </Button>
  );
}

function Checklist({ items, onUpload }: { items: ChecklistItem[]; onUpload: (item: ChecklistItem) => void }) {
  const due = items.filter((item) => item.status !== "upcoming");
  const done = due.filter((item) => item.status === "done").length;

  return (
    <Card className="gap-0 border-[#dce5e2] bg-white py-0 shadow-none xl:sticky xl:top-[100px]">
      <CardContent className="px-5 py-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold">What to keep</p>
          <p className="text-sm text-[#587069]">{done} of {due.length} in place</p>
        </div>
        <Progress value={due.length ? (done / due.length) * 100 : 0} className="mt-3 h-1.5 bg-[#e4ecea] [&_[data-slot=progress-indicator]]:bg-[#0f766e]" />

        <ul className="mt-4 space-y-2">
          {items.map((item) => {
            const Icon = item.status === "done" ? CheckCircle2 : item.status === "upcoming" ? Clock3 : CircleDashed;
            return (
              <li key={item.key} className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5", item.status === "missing" ? "bg-amber-50/70" : "bg-[#f4f7f6]")}>
                <Icon className={cn("mt-0.5 size-4 shrink-0", item.status === "done" ? "text-[#0f766e]" : item.status === "upcoming" ? "text-[#789089]" : "text-amber-700")} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#173d35]">
                    {item.label}
                    <span className="sr-only"> — {item.status === "done" ? "in place" : item.status === "upcoming" ? "not due yet" : "missing"}</span>
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-[#6a7f79]">{item.detail}</p>
                </div>
                {item.status === "missing" ? (
                  <Button type="button" variant="outline" size="xs" className="shrink-0 border-[#e8d9b5] bg-white text-[#173d35]" onClick={() => onUpload(item)}>Upload</Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="mt-4 flex items-start gap-2 border-t border-[#e5ece9] pt-4 text-xs leading-5 text-[#6a7f79]">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[#0f766e]" />Files are private to your account and open through links that expire after a few minutes.
        </p>
      </CardContent>
    </Card>
  );
}

function PreviewDialog({ document, onClose, onDownload }: { document: LoanDocument | null; onClose: () => void; onDownload: (document: LoanDocument) => void }) {
  return (
    <Dialog open={document !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] max-h-[900px] flex-col border-[#dce5e2] bg-white text-[#10201d] sm:max-w-4xl">
        {document ? <Preview key={document.id} document={document} onDownload={() => onDownload(document)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Preview({ document, onDownload }: { document: LoanDocument; onDownload: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    documentUrl(document)
      .then((signed) => { if (active) setUrl(signed); })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Could not open the document."); });
    return () => {
      active = false;
    };
  }, [document]);

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="truncate">{document.file_name}</DialogTitle>
        <DialogDescription>{[categoryLabel(document.category), periodText(document)].filter(Boolean).join(" · ")}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#e5ece9] bg-[#f4f7f6]">
        {error ? (
          <p className="p-6 text-sm text-red-700">{error}</p>
        ) : !url ? (
          <div className="grid h-full place-items-center text-sm text-[#6a7f79]"><LoaderCircle className="size-5 animate-spin text-[#0f766e]" /></div>
        ) : document.mime_type?.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, expiring URLs can't go through the image optimiser
          <img src={url} alt={document.file_name} className="h-full w-full object-contain" />
        ) : (
          <iframe src={url} title={document.file_name} className="h-full w-full" />
        )}
      </div>
      <div className="flex justify-end gap-2">
        {url ? <Button asChild variant="outline" size="sm"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-3.5" />Open in new tab</a></Button> : null}
        <Button type="button" variant="outline" size="sm" onClick={onDownload}><Download className="size-3.5" />Download</Button>
      </div>
    </>
  );
}

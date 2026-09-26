import { assertNotDemo, isDemoMode } from "@/lib/demo";
import { demoDocuments } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase/client";

export const DOCUMENT_BUCKET = "loan-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export type DocumentCategory =
  | "sanction_letter"
  | "disbursement_letter"
  | "loan_statement"
  | "interest_certificate"
  | "payment_receipt"
  | "rate_revision_letter"
  | "other";

// "fy" documents cover one financial year; "range" documents cover a from–to period.
export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; period: "fy" | "range" | null }[] = [
  { value: "sanction_letter", label: "Sanction letter", period: null },
  { value: "disbursement_letter", label: "Disbursement letter", period: null },
  { value: "interest_certificate", label: "Interest certificate", period: "fy" },
  { value: "loan_statement", label: "Loan statement", period: "range" },
  { value: "payment_receipt", label: "Payment receipt", period: null },
  { value: "rate_revision_letter", label: "Rate revision letter", period: null },
  { value: "other", label: "Other", period: null },
];

export function categoryLabel(category: DocumentCategory) {
  return DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label ?? "Other";
}

export type LoanDocument = {
  id: string;
  category: DocumentCategory;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  statement_period_start: string | null;
  statement_period_end: string | null;
  uploaded_at: string;
};

export type DocumentDetails = {
  category: DocumentCategory;
  fileName: string;
  periodStart: string | null;
  periodEnd: string | null;
};

const documentColumns =
  "id, category, file_name, storage_path, mime_type, file_size_bytes, statement_period_start, statement_period_end, uploaded_at";

export function validateDocumentFile(file: File) {
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) return "Upload a PDF, PNG, JPEG or WebP file.";
  if (file.size > MAX_DOCUMENT_BYTES) return "Files can be up to 10 MB.";
  return null;
}

export async function listDocuments(loanId: string): Promise<LoanDocument[]> {
  if (isDemoMode()) return demoDocuments();
  const result = await supabase
    .from("documents")
    .select(documentColumns)
    .eq("loan_id", loanId)
    .order("uploaded_at", { ascending: false });

  if (result.error) throw result.error;
  return (result.data ?? []) as LoanDocument[];
}

function safeFileName(name: string) {
  const cleaned = name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(-120) || "document";
}

// Files live under the user's own folder, which the storage policies require.
export async function uploadDocument({ userId, loanId, file, details }: { userId: string; loanId: string; file: File; details: DocumentDetails }) {
  assertNotDemo();
  const invalid = validateDocumentFile(file);
  if (invalid) throw new Error(invalid);

  const path = `${userId}/${loanId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const upload = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;

  const created = await supabase.from("documents").insert({
    loan_id: loanId,
    category: details.category,
    file_name: details.fileName.trim() || file.name,
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: path,
    mime_type: file.type,
    file_size_bytes: file.size,
    statement_period_start: details.periodStart,
    statement_period_end: details.periodEnd,
  });

  if (created.error) {
    await supabase.storage.from(DOCUMENT_BUCKET).remove([path]);
    throw created.error;
  }
}

export async function updateDocument(id: string, details: DocumentDetails) {
  assertNotDemo();
  const result = await supabase
    .from("documents")
    .update({
      category: details.category,
      file_name: details.fileName.trim(),
      statement_period_start: details.periodStart,
      statement_period_end: details.periodEnd,
    })
    .eq("id", id);

  if (result.error) throw result.error;
}

// Removes the record first so the document disappears for the user even if file cleanup fails.
export async function deleteDocument(document: LoanDocument) {
  assertNotDemo();
  const result = await supabase.from("documents").delete().eq("id", document.id);
  if (result.error) throw result.error;

  const removed = await supabase.storage.from(DOCUMENT_BUCKET).remove([document.storage_path]);
  if (removed.error) console.warn("Document record deleted but its file could not be removed.", removed.error);
}

// Short-lived private link; it stops working after a few minutes.
export async function documentUrl(document: LoanDocument, { download = false }: { download?: boolean } = {}) {
  if (isDemoMode()) throw new Error("Sample documents in the demo have no file to open.");
  const result = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, 300, download ? { download: document.file_name } : undefined);

  if (result.error) throw result.error;
  return result.data.signedUrl;
}

import type { Metadata } from "next";
import { DocumentsPage } from "./documents-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documents · Home Loan Compass",
};

export default function Documents() {
  return <DocumentsPage />;
}

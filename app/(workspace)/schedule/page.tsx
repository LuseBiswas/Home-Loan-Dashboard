import type { Metadata } from "next";
import { SchedulePage } from "./schedule-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schedule · Home Loan Compass",
};

export default function Schedule() {
  return <SchedulePage />;
}

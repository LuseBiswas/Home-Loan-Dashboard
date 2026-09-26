import type { Metadata } from "next";
import { SimulatorPage } from "./simulator-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Simulator · Home Loan Compass",
};

export default function Simulator() {
  return <SimulatorPage />;
}

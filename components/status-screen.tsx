import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function StatusScreen({ title, detail, actionLabel, onAction }: { title: string; detail: string; actionLabel: string; onAction: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f6] px-5 text-[#10201d]">
      <Card className="max-w-lg border-[#dce5e2] bg-white"><CardContent className="px-6 text-center"><h1 className="text-xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-[#6a7f79]">{detail}</p><Button className="mt-6" variant="outline" onClick={onAction}>{actionLabel}</Button></CardContent></Card>
    </main>
  );
}

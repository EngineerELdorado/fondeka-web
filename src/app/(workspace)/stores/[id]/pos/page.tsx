import { notFound } from "next/navigation";
import { StorePos } from "@/components/store-pos";

export default async function StorePosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
  return <StorePos id={id} />;
}

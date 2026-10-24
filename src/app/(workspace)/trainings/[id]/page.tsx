import { notFound } from "next/navigation";
import { TrainingLearner } from "@/components/training-library";
export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) notFound();
  return <TrainingLearner productId={Number(id)} />;
}

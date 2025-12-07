import { StageClient } from "@/components/StageClient";

export default async function StagePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <StageClient code={code} />;
}

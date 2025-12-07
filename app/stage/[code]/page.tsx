import { StageClient } from "@/components/StageClient";

export default function StagePage({ params }: { params: { code: string } }) {
  return <StageClient code={params.code} />;
}

"use client";

import { StageClient } from "@/components/StageClient";
import { useParams } from "next/navigation";

export default function StageRoomPage() {
  const params = useParams<{ code: string }>();
  return params?.code ? <StageClient code={params.code} /> : null;
}

import type { NextRequest } from "next/server";
import { finishAuthentication } from "@/lib/auth/callback";

export function GET(request: NextRequest) {
  return finishAuthentication(request);
}

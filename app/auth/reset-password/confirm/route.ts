import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const destination = new URL(type === "recovery" && tokenHash ? "/auth/reset-password/update" : "/auth/reset-password?error=invalid", request.url);
  if (type !== "recovery" || !tokenHash) return NextResponse.redirect(destination);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return NextResponse.redirect(new URL("/auth/reset-password?error=invalid", request.url));
  return NextResponse.redirect(destination);
}

import { NextResponse } from "next/server";
import { getAuthenticationOptions } from "@/lib/auth/webauthn";

export async function POST() {
  try {
    const { options, challengeId } = await getAuthenticationOptions();
    return NextResponse.json({ options, challengeId });
  } catch (error) {
    console.error("Login options error:", error);
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 },
    );
  }
}

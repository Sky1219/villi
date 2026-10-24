"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAnonId } from "@/lib/anon";

// Shown on every screen while the profile uses the cautious "I don't know" anatomy.
export function AnatomyBanner() {
  const anonId = useAnonId();
  const path = usePathname();
  const profile = useQuery(api.profiles.me, anonId ? { anonId } : "skip");
  if (!profile || profile.anatomyConfirmed || path.startsWith("/onboarding") || path.startsWith("/team")) return null;
  return (
    <div role="status" className="mt-3 rounded-xl border border-flag bg-flag-soft p-3 text-sm print:hidden">
      <p>
        <span className="font-bold">We&apos;re assuming the most cautious case</span> until you confirm{" "}
        {profile.role === "caregiver" ? "their" : "your"} anatomy with {profile.role === "caregiver" ? "their" : "your"} care team.
      </p>
      <Link href="/onboarding" className="mt-1 inline-flex min-h-11 items-center font-bold text-accent underline">
        I know it now
      </Link>
    </div>
  );
}

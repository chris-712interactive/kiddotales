import { createHash, randomBytes } from "crypto";
import { createSupabaseAdmin } from "./supabase";
import { getUserProfile, type UserProfile } from "./db";
import { getTierCapabilities } from "./entitlements";
import { getTierRank } from "./stripe";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type FamilyPlanContext = {
  /** Signed-in user */
  userId: string;
  /** Whose book/voice quota applies */
  billingUserId: string;
  /** Tier used for features and limits (Legend when sharing applies) */
  featureTier: string;
  /** Subscriber who pays, when member is using family plan */
  familyOwnerId: string | null;
};

export function normalizeFamilyInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashFamilyInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateFamilyInviteToken(): string {
  return randomBytes(24).toString("hex");
}

function ownerEligibleForSharing(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return getTierCapabilities(profile.subscriptionTier).sharingSeats > 0;
}

/** Active family membership: member_user_id -> owner. */
export async function getFamilyMemberRecord(
  memberUserId: string
): Promise<{ owner_user_id: string } | null> {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("family_share_members")
    .select("owner_user_id")
    .eq("member_user_id", memberUserId)
    .maybeSingle();
  if (error || !data) return null;
  return { owner_user_id: data.owner_user_id as string };
}

/**
 * Resolves billing user and feature tier. Family members use the owner's pool when the owner
 * still has sharing (Legend), and the owner's tier ranks higher than the member's own tier.
 */
export async function resolveFamilyPlanContext(
  userId: string
): Promise<FamilyPlanContext> {
  const profile = await getUserProfile(userId);
  const ownTier = profile?.subscriptionTier ?? "free";

  const memberRow = await getFamilyMemberRecord(userId);
  if (memberRow) {
    const ownerProfile = await getUserProfile(memberRow.owner_user_id);
    if (ownerEligibleForSharing(ownerProfile)) {
      const ownerRank = getTierRank(ownerProfile!.subscriptionTier);
      const ownRank = getTierRank(ownTier);
      if (ownerRank > ownRank) {
        return {
          userId,
          billingUserId: memberRow.owner_user_id,
          featureTier: ownerProfile!.subscriptionTier,
          familyOwnerId: memberRow.owner_user_id,
        };
      }
    }
  }

  return {
    userId,
    billingUserId: userId,
    featureTier: ownTier,
    familyOwnerId: null,
  };
}

export async function revokeFamilySharingForOwner(ownerUserId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase.from("family_share_members").delete().eq("owner_user_id", ownerUserId);
  await supabase.from("family_share_invites").delete().eq("owner_user_id", ownerUserId);
}

export async function countFamilySeatUsage(ownerUserId: string): Promise<{
  members: number;
  pendingInvites: number;
}> {
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  const [{ count: mCount }, { data: invites }] = await Promise.all([
    supabase
      .from("family_share_members")
      .select("*", { count: "exact", head: true })
      .eq("owner_user_id", ownerUserId),
    supabase
      .from("family_share_invites")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .is("accepted_at", null)
      .gt("expires_at", now),
  ]);

  return {
    members: mCount ?? 0,
    pendingInvites: invites?.length ?? 0,
  };
}

export type FamilySharingDashboard = {
  role: "owner" | "member" | null;
  seatsTotal: number;
  seatsUsed: number;
  members: { memberUserId: string; email: string | null }[];
  pendingInvites: { id: string; invitedEmail: string; expiresAt: string }[];
  ownerEmail?: string | null;
};

export async function getFamilySharingDashboard(
  userId: string,
  profile: UserProfile | null
): Promise<FamilySharingDashboard> {
  const seatsTotal = profile
    ? getTierCapabilities(profile.subscriptionTier).sharingSeats
    : 0;

  if (seatsTotal > 0) {
    const supabase = createSupabaseAdmin();
    const usage = await countFamilySeatUsage(userId);
    const seatsUsed = usage.members + usage.pendingInvites;

    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase
        .from("family_share_members")
        .select("member_user_id")
        .eq("owner_user_id", userId),
      supabase
        .from("family_share_invites")
        .select("id, invited_email, expires_at")
        .eq("owner_user_id", userId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);

    const memberIds = (memberRows ?? []).map((r) => r.member_user_id as string);
    const emailsMap = new Map<string, string | null>();
    if (memberIds.length) {
      const { data: users } = await supabase
        .from("users")
        .select("id, email")
        .in("id", memberIds);
      for (const u of users ?? []) {
        emailsMap.set(u.id as string, (u.email as string) ?? null);
      }
    }

    return {
      role: "owner",
      seatsTotal,
      seatsUsed,
      members: memberIds.map((memberUserId) => ({
        memberUserId,
        email: emailsMap.get(memberUserId) ?? null,
      })),
      pendingInvites: (inviteRows ?? []).map((r) => ({
        id: r.id as string,
        invitedEmail: r.invited_email as string,
        expiresAt: r.expires_at as string,
      })),
    };
  }

  const memberRow = await getFamilyMemberRecord(userId);
  if (memberRow) {
    const ownerProfile = await getUserProfile(memberRow.owner_user_id);
    const ownerEmail = ownerProfile?.email ?? null;
    return {
      role: "member",
      seatsTotal: 0,
      seatsUsed: 0,
      members: [],
      pendingInvites: [],
      ownerEmail,
    };
  }

  return {
    role: null,
    seatsTotal: 0,
    seatsUsed: 0,
    members: [],
    pendingInvites: [],
  };
}

export type FamilyInviteCreateResult =
  | { ok: true; inviteId: string; acceptUrl: string }
  | { ok: false; error: string };

export async function createFamilyShareInvite(
  ownerUserId: string,
  invitedEmailRaw: string
): Promise<FamilyInviteCreateResult> {
  const ownerProfile = await getUserProfile(ownerUserId);
  if (!ownerEligibleForSharing(ownerProfile)) {
    return {
      ok: false,
      error: "Family sharing is available on the Legend plan only.",
    };
  }

  const invitedEmail = normalizeFamilyInviteEmail(invitedEmailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const ownerEmail = ownerProfile?.email
    ? normalizeFamilyInviteEmail(ownerProfile.email)
    : "";
  if (ownerEmail && ownerEmail === invitedEmail) {
    return { ok: false, error: "You cannot invite your own email." };
  }

  const seats = getTierCapabilities(ownerProfile!.subscriptionTier).sharingSeats;
  const usage = await countFamilySeatUsage(ownerUserId);
  if (usage.members + usage.pendingInvites >= seats) {
    return {
      ok: false,
      error:
        "All family seats are in use. Remove a member or cancel a pending invite first.",
    };
  }

  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();
  const { data: pendingDup } = await supabase
    .from("family_share_invites")
    .select("id")
    .eq("owner_user_id", ownerUserId)
    .eq("invited_email", invitedEmail)
    .is("accepted_at", null)
    .gt("expires_at", now)
    .maybeSingle();
  if (pendingDup) {
    return {
      ok: false,
      error: "An invite is already pending for that email.",
    };
  }

  const { data: userRows } = await supabase
    .from("users")
    .select("id")
    .ilike("email", invitedEmail);
  const existingId = userRows?.[0]?.id as string | undefined;
  if (existingId) {
    const m = await getFamilyMemberRecord(existingId);
    if (m) {
      return {
        ok: false,
        error: "That account is already linked to a family plan.",
      };
    }
    if (existingId === ownerUserId) {
      return { ok: false, error: "You cannot invite your own account." };
    }
  }

  const token = generateFamilyInviteToken();
  const tokenHash = hashFamilyInviteToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  const { data: ins, error } = await supabase
    .from("family_share_invites")
    .insert({
      owner_user_id: ownerUserId,
      invited_email: invitedEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !ins) {
    console.error("[family-sharing] insert invite:", error);
    return { ok: false, error: "Could not create invite." };
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const acceptUrl = `${base}/family/join?token=${encodeURIComponent(token)}`;

  return { ok: true, inviteId: ins.id as string, acceptUrl };
}

export type FamilyAcceptResult =
  | { ok: true }
  | { ok: false; error: string };

export async function acceptFamilyShareInvite(
  token: string,
  memberUserId: string,
  memberEmailRaw: string | null | undefined
): Promise<FamilyAcceptResult> {
  const memberEmail = memberEmailRaw
    ? normalizeFamilyInviteEmail(memberEmailRaw)
    : "";
  if (!memberEmail) {
    return { ok: false, error: "Your account needs an email to accept a family invite." };
  }

  const existingMembership = await getFamilyMemberRecord(memberUserId);
  if (existingMembership) {
    return { ok: false, error: "Your account is already on a family plan." };
  }

  const tokenHash = hashFamilyInviteToken(token.trim());
  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: invite, error: fetchErr } = await supabase
    .from("family_share_invites")
    .select("*")
    .eq("token_hash", tokenHash)
    .is("accepted_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (fetchErr || !invite) {
    return {
      ok: false,
      error: "This invite link is invalid or has expired. Ask the plan owner to send a new one.",
    };
  }

  const invitedEmail = invite.invited_email as string;
  if (invitedEmail !== memberEmail) {
    return {
      ok: false,
      error:
        "Sign in with the Google account that uses the invited email address.",
    };
  }

  const ownerUserId = invite.owner_user_id as string;
  if (ownerUserId === memberUserId) {
    return { ok: false, error: "You cannot accept your own invite." };
  }

  const ownerProfile = await getUserProfile(ownerUserId);
  if (!ownerEligibleForSharing(ownerProfile)) {
    return {
      ok: false,
      error: "This family plan is no longer active. The owner may need to renew Legend.",
    };
  }

  const seats = getTierCapabilities(ownerProfile!.subscriptionTier).sharingSeats;
  const usage = await countFamilySeatUsage(ownerUserId);
  if (usage.members >= seats) {
    return { ok: false, error: "This family plan has no open seats." };
  }

  const { error: insErr } = await supabase.from("family_share_members").insert({
    owner_user_id: ownerUserId,
    member_user_id: memberUserId,
  });
  if (insErr) {
    console.error("[family-sharing] accept insert member:", insErr);
    return { ok: false, error: "Could not join family plan. Try again." };
  }

  await supabase
    .from("family_share_invites")
    .update({
      accepted_at: new Date().toISOString(),
      member_user_id: memberUserId,
    })
    .eq("id", invite.id);

  return { ok: true };
}

export async function cancelFamilyShareInvite(
  ownerUserId: string,
  inviteId: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("family_share_invites")
    .delete()
    .eq("id", inviteId)
    .eq("owner_user_id", ownerUserId)
    .is("accepted_at", null);
  return !error;
}

export async function removeFamilyShareMember(
  ownerUserId: string,
  memberUserId: string
): Promise<boolean> {
  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("family_share_members")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .eq("member_user_id", memberUserId);
  return !error;
}

import { useState, useEffect } from "react";
import { type Member } from "@/lib/community";
import {
  type CommunityInvite,
  type PendingCreatorApproval,
  createCommunityInvite,
  fetchCommunityInvites,
  fetchPendingApprovals,
  approveCreatorChannelWithPvToken,
  fetchPartnerShowcaseStreamers,
  savePartnerShowcaseStreamers,
} from "@/lib/invites";
import { inputClass, buttonClass, ghostButtonClass, Avatar } from "@/components/community/Bits";

export function AdminInvitesAndApprovals({
  adminId,
  adminName,
  adminHandle,
  allMembers,
  onToast,
}: {
  adminId: string;
  adminName: string;
  adminHandle: string;
  allMembers: Member[];
  onToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"invites" | "approvals" | "showcase">("approvals");
  const [invites, setInvites] = useState<CommunityInvite[]>([]);
  const [approvals, setApprovals] = useState<PendingCreatorApproval[]>([]);
  const [partnerShowcaseIds, setPartnerShowcaseIds] = useState<string[]>([]);
  const [campaign, setCampaign] = useState("direct");
  const [generating, setGenerating] = useState(false);
  const [pvTokensByCreator, setPvTokensByCreator] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [invitesData, approvalsData, showcaseData] = await Promise.all([
      fetchCommunityInvites(),
      fetchPendingApprovals(),
      fetchPartnerShowcaseStreamers(),
    ]);
    setInvites(invitesData);
    setApprovals(approvalsData);
    setPartnerShowcaseIds(showcaseData.length > 0 ? showcaseData : allMembers.slice(0, 5).map((m) => m.id));
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [allMembers]);

  async function handleCreateInvite() {
    setGenerating(true);
    const res = await createCommunityInvite(adminId, adminName, adminHandle, campaign);
    setGenerating(false);
    if (res.success && res.code) {
      onToast(`🎉 Created invite code: ${res.code}`);
      void loadData();
    } else {
      onToast(res.error || "Failed to create invite");
    }
  }

  async function handleApprove(creator: PendingCreatorApproval) {
    const token = (pvTokensByCreator[creator.id] || creator.pv_token || "PV-STREAMCORE-VERIFIED").trim();
    if (!token) {
      onToast("Please enter a PV Token to approve this channel");
      return;
    }

    setApprovingId(creator.id);
    const res = await approveCreatorChannelWithPvToken(creator.id, token, adminId);
    setApprovingId(null);

    if (res.success) {
      onToast(`✓ Approved channel for ${creator.display_name}! Congratulations email sent.`);
      void loadData();
    } else {
      onToast(res.error || "Could not approve channel");
    }
  }

  async function handleToggleShowcase(memberId: string) {
    const updated = partnerShowcaseIds.includes(memberId)
      ? partnerShowcaseIds.filter((id) => id !== memberId)
      : [...partnerShowcaseIds, memberId];
    setPartnerShowcaseIds(updated);
    await savePartnerShowcaseStreamers(updated);
    onToast("Updated onboarding partner showcase");
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://peak-pylon.vercel.app";

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setTab("approvals")}
          className={`rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "approvals" ? "bg-primary text-primary-foreground shadow" : "bg-accent text-muted-foreground hover:text-foreground"
          }`}
        >
          🛡️ Pending Channel Approvals ({approvals.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("invites")}
          className={`rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "invites" ? "bg-primary text-primary-foreground shadow" : "bg-accent text-muted-foreground hover:text-foreground"
          }`}
        >
          🔗 Community Invites CRM ({invites.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("showcase")}
          className={`rounded-xl px-4 py-2 text-xs font-black transition ${
            tab === "showcase" ? "bg-primary text-primary-foreground shadow" : "bg-accent text-muted-foreground hover:text-foreground"
          }`}
        >
          ⭐ Onboarding Partner Showcase
        </button>
      </div>

      {/* TAB 1: PENDING CHANNEL APPROVALS */}
      {tab === "approvals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-foreground">Pending Creator Channel Approvals</h3>
              <p className="text-xs text-muted-foreground">
                Review new streamer signups, verify their PV Token, and approve their channel to unlock chat.
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className={`${ghostButtonClass} text-xs font-bold`}
            >
              🔄 Refresh List
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading pending creators...</p>
          ) : approvals.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-popover/40 p-8 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm font-bold text-foreground">No Pending Channel Approvals</p>
              <p className="text-xs text-muted-foreground mt-1">All registered creators have been verified and approved.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvals.map((creator) => (
                <div
                  key={creator.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-popover p-4 shadow-sm hover:border-primary transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={creator.avatar_url || "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&q=80"}
                      alt={creator.display_name}
                      className="h-12 w-12 rounded-2xl object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold text-foreground">{creator.display_name}</strong>
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-black text-amber-400 border border-amber-500/30">
                          PENDING APPROVAL
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{creator.handle || "@streamer"}</p>
                      {creator.channel_url && (
                        <a
                          href={creator.channel_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          {creator.channel_url} ↗
                        </a>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Joined: {new Date(creator.created_at).toLocaleString()} • Invite: {creator.invite_code_used || "Direct"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PV Token</label>
                      <input
                        type="text"
                        value={pvTokensByCreator[creator.id] ?? "PV-8F42K-STREAM"}
                        onChange={(e) =>
                          setPvTokensByCreator((prev) => ({ ...prev, [creator.id]: e.target.value }))
                        }
                        placeholder="e.g. PV-8F42K-STREAM"
                        className={`${inputClass} text-xs py-1.5 w-44 font-mono font-bold`}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={approvingId === creator.id}
                      onClick={() => handleApprove(creator)}
                      className={`${buttonClass} mt-4 py-2.5 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-500 shadow-md`}
                    >
                      {approvingId === creator.id ? "Approving..." : "✓ Approve Channel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVITES MANAGER */}
      {tab === "invites" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-popover p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-black text-foreground">Generate New Community Invite Link</h3>
              <p className="text-xs text-muted-foreground">Create unique trackable links for streamer recruitment campaigns.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
                placeholder="Campaign (e.g. twitter, discord)"
                className={`${inputClass} text-xs py-2 w-40`}
              />
              <button
                type="button"
                disabled={generating}
                onClick={handleCreateInvite}
                className={`${buttonClass} py-2 px-4 text-xs font-black shrink-0`}
              >
                {generating ? "Creating..." : "+ Generate Invite"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-popover">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-accent/30 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Invite Link / Code</th>
                  <th className="p-3">Sent By</th>
                  <th className="p-3">Campaign</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Invited Creator</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map((inv) => {
                  const link = `${origin}/join/${inv.code}`;
                  return (
                    <tr key={inv.id} className="hover:bg-accent/20 transition">
                      <td className="p-3 font-mono font-bold text-primary">
                        {inv.code}
                      </td>
                      <td className="p-3 font-bold text-foreground">
                        {inv.inviter_name || "Admin"} <span className="text-muted-foreground text-[10px]">({inv.inviter_handle || "@admin"})</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{inv.campaign}</td>
                      <td className="p-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            inv.status === "approved"
                              ? "bg-online/20 text-online"
                              : inv.status === "joined"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3">
                        {inv.invited_creator_name ? (
                          <div>
                            <strong className="text-foreground">{inv.invited_creator_name}</strong>
                            <p className="text-muted-foreground text-[10px]">{inv.invited_creator_channel || "Twitch"}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Not registered yet</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(link);
                            onToast(`📋 Copied invite link: ${link}`);
                          }}
                          className={`${ghostButtonClass} text-[11px] font-bold text-primary hover:underline`}
                        >
                          Copy Link 📋
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ONBOARDING PARTNER SHOWCASE */}
      {tab === "showcase" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-black text-foreground">Onboarding Partner Showcase</h3>
            <p className="text-xs text-muted-foreground">
              Select which verified partner streamer avatars appear on the new creator onboarding & channel authorization page.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allMembers.map((member) => {
              const selected = partnerShowcaseIds.includes(member.id);
              return (
                <div
                  key={member.id}
                  onClick={() => handleToggleShowcase(member.id)}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition ${
                    selected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-popover hover:border-border/80 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar member={member} size={36} showStatus={false} />
                    <div className="min-w-0">
                      <strong className="text-xs font-bold text-foreground block truncate">{member.name}</strong>
                      <span className="text-[10px] text-muted-foreground truncate block">{member.handle}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${selected ? "text-primary" : "text-muted-foreground"}`}>
                    {selected ? "✓ Active" : "+ Add"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

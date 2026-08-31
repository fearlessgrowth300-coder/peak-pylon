import { useState, useEffect } from "react";
import { type Account } from "@/lib/account";
import { buttonClass } from "@/components/community/Bits";

export function PendingApprovalGateBanner({
  account,
  onOpenMessageAdmin,
}: {
  account: Account;
  onOpenMessageAdmin: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(300); // 5 minutes = 300 seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border-2 border-primary/50 bg-gradient-to-r from-primary/20 via-popover to-accent/40 p-5 shadow-xl animate-in slide-in-from-top-4 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex h-6 items-center rounded-md bg-amber-500/20 px-2 text-[11px] font-black text-amber-400 border border-amber-500/30">
              🔒 PENDING CHANNEL APPROVAL
            </span>
            <span className="flex items-center gap-1 rounded-md bg-destructive/20 px-2 py-0.5 text-[11px] font-black text-destructive border border-destructive/30 animate-pulse">
              ⏱️ Unapproved Chat Lock: {timeFormatted}
            </span>
          </div>

          <h3 className="text-lg font-black text-foreground">
            Get Your Channel Approved to Unlock Chat & Community Raids
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your welcome announcement is live in #general and community streamers are celebrating your arrival!
            To participate in chat, receive raid trains from top creators, and get featured, your channel must be verified with a <strong>PV Token</strong>.
          </p>

          <div className="mt-2 rounded-xl bg-background/70 border border-border p-3 text-xs text-foreground space-y-1">
            <p className="font-bold text-primary">🔑 How to get your channel approved:</p>
            <p className="text-muted-foreground text-[11px]">
              1. Contact the person who gave you the invite link or the Admin.<br />
              2. Request your <strong>PV Token</strong> (Proof of Verification Token).<br />
              3. Once the Admin verifies your PV Token in the Control Center, your channel will be immediately approved and congratulations email sent!
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenMessageAdmin}
            className={`${buttonClass} px-5 py-3 text-xs font-black shadow-lg shadow-primary/30 flex items-center justify-center gap-2`}
          >
            <span>✉️</span> Message Admin / Inviter for PV Token
          </button>
        </div>
      </div>
    </div>
  );
}

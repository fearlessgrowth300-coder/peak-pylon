import { useEffect, useState } from "react";
import { Field, buttonClass, inputClass } from "./Bits";
import {
  GEMINI_MODEL_OPTIONS,
  generateCommunityAiMessage,
  getGeminiIntegrationStatus,
  saveGeminiIntegration,
  setAiAutopilotConfig,
  testGeminiIntegration,
  type AiAutopilotConfig,
  type GeminiModel,
} from "@/lib/gemini.functions";
import {
  getResendIntegrationStatus,
  saveResendIntegration,
  sendResendTestEmail,
  type ServerResendConfig,
} from "@/lib/resend.functions";
import type { CommunityChannel } from "@/lib/community";

const DEFAULT_AUTOPILOT: AiAutopilotConfig = {
  active: false,
  intervalMinutes: 10,
  channel: "general",
  stickers: true,
  liveContext: true,
  model: "gemini-3.5-flash-lite",
  lastStatus: "Stopped",
  lastRunAt: null,
  lastError: null,
};

const DEFAULT_RESEND: ServerResendConfig = {
  fromEmail: "StreamCore Alerts <noreply@authenticcommunity.fun>",
  notifyNewAnnouncement: true,
  notifyRepliesAndMentions: true,
  notifyNewClips: true,
  notifyStreamerLive: true,
};

export function IntegrationControlCenter({
  accessToken,
  channels,
  notify,
}: {
  accessToken: string;
  channels: CommunityChannel[];
  notify: (message: string) => void;
}) {
  const [geminiKeysText, setGeminiKeysText] = useState("");
  const [geminiKeyCount, setGeminiKeyCount] = useState(0);
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(DEFAULT_AUTOPILOT.model);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiMessage, setGeminiMessage] = useState("");
  const [autopilot, setAutopilot] = useState<AiAutopilotConfig>(DEFAULT_AUTOPILOT);
  const [autopilotBusy, setAutopilotBusy] = useState(false);

  const [resendApiKey, setResendApiKey] = useState("");
  const [resendConfigured, setResendConfigured] = useState(false);
  const [resendConfig, setResendConfig] = useState<ServerResendConfig>(DEFAULT_RESEND);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [testEmailTarget, setTestEmailTarget] = useState("");

  async function refreshStatuses() {
    const [gemini, resend] = await Promise.all([
      getGeminiIntegrationStatus({ data: { accessToken } }),
      getResendIntegrationStatus({ data: { accessToken } }),
    ]);
    setGeminiConfigured(gemini.configured);
    setGeminiKeyCount(gemini.keyCount);
    setGeminiModel(gemini.model);
    setAutopilot(gemini.autopilot);
    setResendConfigured(resend.configured);
    setResendConfig(resend.config);
  }

  useEffect(() => {
    let cancelled = false;
    void refreshStatuses().catch((error) => {
      if (!cancelled) setGeminiMessage(error instanceof Error ? error.message : "Could not load integration status.");
    });
    return () => { cancelled = true; };
  }, [accessToken]);

  async function saveGeminiPool() {
    setGeminiBusy(true);
    setGeminiMessage("Saving the secure key pool…");
    try {
      const apiKeys = geminiKeysText.split(/\r?\n/).map((key) => key.trim()).filter(Boolean);
      const result = await saveGeminiIntegration({ data: { accessToken, apiKeys, model: geminiModel } });
      setGeminiConfigured(result.configured);
      setGeminiKeyCount(result.keyCount);
      setGeminiKeysText("");
      setAutopilot((current) => ({ ...current, model: result.model }));
      setGeminiMessage(`${result.keyCount} Gemini key${result.keyCount === 1 ? "" : "s"} stored securely.`);
      notify("Gemini key pool saved securely");
    } catch (error) {
      setGeminiMessage(error instanceof Error ? error.message : "Gemini keys could not be saved.");
    } finally {
      setGeminiBusy(false);
    }
  }

  async function testGemini() {
    setGeminiBusy(true);
    setGeminiMessage("Testing the saved Gemini pool…");
    try {
      const result = await testGeminiIntegration({ data: { accessToken } });
      setGeminiConfigured(true);
      setGeminiKeyCount(result.keyCount);
      setGeminiMessage(result.message);
      notify("Gemini connection verified");
    } catch (error) {
      setGeminiMessage(error instanceof Error ? error.message : "Gemini connection failed.");
    } finally {
      setGeminiBusy(false);
    }
  }

  async function saveAutopilot(active: boolean, next = autopilot) {
    setAutopilotBusy(true);
    try {
      const result = await setAiAutopilotConfig({
        data: {
          accessToken,
          active,
          intervalMinutes: next.intervalMinutes,
          channel: next.channel,
          stickers: next.stickers,
          liveContext: next.liveContext,
        },
      });
      setAutopilot(result);
      notify(active ? "AI autopilot schedule saved and running" : "AI autopilot settings saved (stopped)");
    } catch (error) {
      notify(error instanceof Error ? error.message : "AI autopilot could not be updated");
    } finally {
      setAutopilotBusy(false);
    }
  }

  async function sendAiTestMessage() {
    setAutopilotBusy(true);
    try {
      await generateCommunityAiMessage({ data: { accessToken } });
      await refreshStatuses();
      notify("StreamCore AI posted one real test message in chat");
    } catch (error) {
      notify(error instanceof Error ? error.message : "The AI test message failed");
    } finally {
      setAutopilotBusy(false);
    }
  }

  async function saveResend() {
    setResendBusy(true);
    setResendMessage("Saving Resend settings…");
    try {
      const result = await saveResendIntegration({ data: { accessToken, apiKey: resendApiKey.trim(), config: resendConfig } });
      setResendConfigured(result.configured);
      setResendConfig(result.config);
      setResendApiKey("");
      setResendMessage("Resend credentials and notification settings are stored on the server.");
      notify("Resend settings saved securely");
    } catch (error) {
      setResendMessage(error instanceof Error ? error.message : "Resend settings could not be saved.");
    } finally {
      setResendBusy(false);
    }
  }

  async function testResend() {
    setResendBusy(true);
    setResendMessage("Sending the test email…");
    try {
      await sendResendTestEmail({ data: { accessToken, to: testEmailTarget } });
      setResendMessage(`Test email sent to ${testEmailTarget}.`);
      notify("Resend test email sent");
    } catch (error) {
      setResendMessage(error instanceof Error ? error.message : "The Resend test failed.");
    } finally {
      setResendBusy(false);
    }
  }

  const chatChannels = [
    { id: "general", name: "general" },
    ...channels.filter((channel) => channel.allowChat && channel.id !== "general"),
  ];

  return (
    <>
      <section className="space-y-4 rounded-xl border border-primary/25 bg-popover p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">07 · Gemini AI Multi-Key Pool & Model Engine</h2>
            <p className="mt-1 text-xs text-muted-foreground">Add multiple real Gemini API keys. StreamCore rotates the secured pool when a key is rate-limited.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${geminiConfigured ? "bg-primary/20 text-primary" : "bg-accent text-muted-foreground"}`}>
            {geminiKeyCount} {geminiKeyCount === 1 ? "Key" : "Keys"} In Pool
          </span>
        </div>
        <Field label="Gemini API keys · Paste one per line">
          <textarea
            rows={4}
            value={geminiKeysText}
            onChange={(event) => setGeminiKeysText(event.target.value)}
            placeholder={geminiConfigured ? "Saved keys stay hidden. Paste new keys here only to replace the pool." : "Paste Gemini API keys, one per line"}
            className={`${inputClass} min-h-24 resize-y font-mono text-xs`}
            autoComplete="off"
            aria-label="Gemini API keys"
          />
        </Field>
        <p className="text-xs text-muted-foreground">🔑 Need a key? Create one at <a className="font-semibold text-primary underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio ↗</a>. Existing saved keys are never shown again.</p>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(160px,.8fr)_minmax(160px,.8fr)]">
          <Field label="AI model engine">
            <select value={geminiModel} onChange={(event) => setGeminiModel(event.target.value as GeminiModel)} className={inputClass}>
              {GEMINI_MODEL_OPTIONS.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
            </select>
          </Field>
          <button type="button" disabled={geminiBusy || (!geminiKeysText.trim() && !geminiConfigured)} onClick={() => void saveGeminiPool()} className={`${buttonClass} self-end disabled:opacity-50`}>
            {geminiBusy ? "Working…" : "💾 Save keys"}
          </button>
          <button type="button" disabled={geminiBusy || !geminiConfigured} onClick={() => void testGemini()} className="self-end rounded-md bg-accent px-4 py-2 text-sm font-bold hover:bg-accent/75 disabled:opacity-50">
            ⚡ Test connection
          </button>
        </div>
        {geminiMessage && <p className="rounded-lg border border-border bg-background/70 p-3 text-xs font-semibold text-muted-foreground">{geminiMessage}</p>}
      </section>

      <section className="space-y-4 rounded-xl border border-primary/25 bg-popover p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">08 · 24/7 Community Activity Engine</h2>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Keeps chat active naturally among admin-added creators talking about real live streams, gameplay, and community topics.</p>
          </div>
          <span className={`rounded-full px-4 py-2 text-xs font-black ${autopilot.active ? "bg-online/20 text-online" : "bg-background text-muted-foreground"}`}>
            {autopilot.active ? "🟢 AUTOPILOT RUNNING" : "🔴 AUTOPILOT STOPPED"}
          </span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <button type="button" disabled={autopilotBusy || !geminiConfigured} onClick={() => void saveAutopilot(!autopilot.active)} className={`rounded-xl px-5 py-4 text-base font-black disabled:opacity-50 ${autopilot.active ? "bg-destructive text-destructive-foreground" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}>
            {autopilotBusy ? "Updating…" : autopilot.active ? "■ Stop 24/7 AI Chat Autopilot" : "▶ Start 24/7 AI Chat Autopilot"}
          </button>
          <button type="button" disabled={autopilotBusy || !geminiConfigured} onClick={() => void saveAutopilot(autopilot.active)} className="rounded-xl bg-accent px-5 py-4 text-sm font-bold hover:bg-accent/75 disabled:opacity-50">💾 Save schedule</button>
          <button type="button" disabled={autopilotBusy || !geminiConfigured} onClick={() => void sendAiTestMessage()} className="rounded-xl bg-accent px-5 py-4 text-sm font-bold hover:bg-accent/75 disabled:opacity-50">⚡ Send 1 test message</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={autopilot.stickers} onChange={(event) => setAutopilot((current) => ({ ...current, stickers: event.target.checked }))} /> Send animated streamer stickers in chat</label>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={autopilot.liveContext} onChange={(event) => setAutopilot((current) => ({ ...current, liveContext: event.target.checked }))} /> Include confirmed live-stream events and mentions</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Chat frequency interval">
            <select value={autopilot.intervalMinutes} onChange={(event) => setAutopilot((current) => ({ ...current, intervalMinutes: Number(event.target.value) }))} className={inputClass}>
              <option value={5}>Every 5 minutes (high activity)</option>
              <option value={10}>Every 10 minutes (recommended)</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
            </select>
          </Field>
          <Field label="Target chat channel">
            <select value={autopilot.channel} onChange={(event) => setAutopilot((current) => ({ ...current, channel: event.target.value }))} className={inputClass}>
              {chatChannels.map((channel) => <option key={channel.id} value={channel.name}># {channel.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Status: <strong className="text-foreground">{autopilot.lastStatus || (autopilot.active ? "Scheduled" : "Stopped")}</strong></span>
          {autopilot.lastRunAt && <span>Last post: <strong className="text-foreground">{new Date(autopilot.lastRunAt).toLocaleString()}</strong></span>}
          {autopilot.lastError && <span className="text-destructive">{autopilot.lastError}</span>}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-primary/25 bg-popover p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">09 · Resend Email Notifications for Real Streamers</h2>
            <p className="mt-1 text-xs text-muted-foreground">Securely configure real email notifications for signed-up members, announcements, live alerts, replies, and imported clips.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${resendConfigured ? "bg-online/20 text-online" : "bg-accent text-muted-foreground"}`}>
            {resendConfigured ? "✉ Resend active" : "Resend not connected"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Resend API key · Admin only">
            <input type="password" value={resendApiKey} onChange={(event) => setResendApiKey(event.target.value)} placeholder={resendConfigured ? "Saved securely · enter a new key only to replace it" : "re_…"} className={inputClass} autoComplete="new-password" />
          </Field>
          <Field label="Sender 'From' address">
            <input value={resendConfig.fromEmail} onChange={(event) => setResendConfig((current) => ({ ...current, fromEmail: event.target.value }))} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={resendConfig.notifyRepliesAndMentions} onChange={(event) => setResendConfig((current) => ({ ...current, notifyRepliesAndMentions: event.target.checked }))} /> ✉ Send email on replies and mentions</label>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={resendConfig.notifyNewAnnouncement} onChange={(event) => setResendConfig((current) => ({ ...current, notifyNewAnnouncement: event.target.checked }))} /> 📢 Send email on official announcements</label>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={resendConfig.notifyStreamerLive} onChange={(event) => setResendConfig((current) => ({ ...current, notifyStreamerLive: event.target.checked }))} /> 🔴 Send email when a creator goes live</label>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={resendConfig.notifyNewClips} onChange={(event) => setResendConfig((current) => ({ ...current, notifyNewClips: event.target.checked }))} /> 🎬 Send email when clips are posted</label>
        </div>
        <button type="button" disabled={resendBusy || (!resendConfigured && !resendApiKey.trim())} onClick={() => void saveResend()} className={`${buttonClass} disabled:opacity-50`}>{resendBusy ? "Working…" : "💾 Save Resend settings"}</button>
        <div className="grid gap-2 border-t border-border/50 pt-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input type="email" value={testEmailTarget} onChange={(event) => setTestEmailTarget(event.target.value)} placeholder="Enter an email address for a real test" className={inputClass} />
          <button type="button" disabled={resendBusy || !resendConfigured || !testEmailTarget} onClick={() => void testResend()} className={`${buttonClass} disabled:opacity-50`}>✉ Send test email</button>
        </div>
        {resendMessage && <p className="rounded-lg border border-border bg-background/70 p-3 text-xs font-semibold text-muted-foreground">{resendMessage}</p>}
      </section>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | StreamCore" },
      { name: "description", content: "How StreamCore collects, uses, and protects personal information." },
    ],
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">Back to StreamCore</Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective September 8, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section><h2 className="text-xl font-semibold text-foreground">Information we collect</h2><p className="mt-2">StreamCore collects account details you provide, creator profile information, community posts, reactions, messages, and moderation records. When you connect a streaming or social account, we receive the profile and channel information authorized by that provider.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">How we use information</h2><p className="mt-2">We use this information to authenticate accounts, operate community features, show current creator and stream information, enforce community rules, prevent abuse, send requested service notifications, and improve reliability.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Service providers</h2><p className="mt-2">StreamCore uses Supabase for authentication and data storage, Twitch and other authorized platforms for creator data, and Resend for service email. Server-side automation may use configured model providers for administrative community features. Access is limited to the information needed for each function.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Local storage and security</h2><p className="mt-2">The app may store session and interface preferences in your browser. Private service credentials are kept in protected server environments and are not intentionally exposed to browsers. No internet service can guarantee absolute security.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Your choices</h2><p className="mt-2">You may update profile details, disconnect supported services, request a password reset, or ask an administrator to review or delete eligible account information. Legal retention and safety obligations may require us to keep limited records.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Contact and updates</h2><p className="mt-2">Contact a StreamCore administrator through the in-app support or messages area with privacy questions. We may update this policy as the service changes and will revise the effective date when we do.</p></section>
        </div>
      </article>
    </main>
  );
}

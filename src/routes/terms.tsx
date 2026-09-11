import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions | StreamCore" },
      { name: "description", content: "Terms governing use of the StreamCore creator community." },
    ],
  }),
  component: TermsAndConditions,
});

function TermsAndConditions() {
  return (
    <main className="min-h-screen bg-background px-5 py-12 text-foreground">
      <article className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm font-semibold text-primary hover:underline">Back to StreamCore</Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective September 8, 2026</p>

        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <section><h2 className="text-xl font-semibold text-foreground">Using StreamCore</h2><p className="mt-2">You must provide accurate account information, keep your login secure, follow the Community Rules, and use the service lawfully. You are responsible for activity performed through your account.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Creator accounts and connections</h2><p className="mt-2">Connecting a creator channel authorizes StreamCore to retrieve and display permitted channel information. Approval, verification, ranking, and feature access may depend on current provider data and community moderation decisions.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Your content</h2><p className="mt-2">You retain ownership of content you submit. You grant StreamCore a non-exclusive license to host, display, format, and distribute that content only as needed to operate and promote the community. Do not submit content you lack permission to use.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Prohibited conduct</h2><p className="mt-2">Do not harass others, impersonate people, manipulate engagement, upload unlawful material, exploit the service, scrape restricted data, evade moderation, or interfere with security and availability.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Moderation and availability</h2><p className="mt-2">Administrators may remove content, limit features, suspend accounts, or revoke access to protect users and enforce these terms. Features may change, pause, or become unavailable, including when third-party services are interrupted.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Third-party services</h2><p className="mt-2">Connected platforms and external links are governed by their own terms and privacy policies. StreamCore is not responsible for third-party services or content.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Disclaimers and liability</h2><p className="mt-2">StreamCore is provided on an as-available basis. To the extent permitted by applicable law, StreamCore disclaims implied warranties and is not liable for indirect or consequential loss arising from use of the service.</p></section>
          <section><h2 className="text-xl font-semibold text-foreground">Changes and contact</h2><p className="mt-2">We may update these terms as the service changes. Continued use after an update means you accept the revised terms. Contact a StreamCore administrator through the in-app support or messages area with questions.</p></section>
        </div>
      </article>
    </main>
  );
}

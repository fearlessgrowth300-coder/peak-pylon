import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/join/$code")({
  beforeLoad: ({ params }) => {
    const code = params.code.trim().toUpperCase();
    throw redirect({ href: `/?invite=${encodeURIComponent(code)}` });
  },
});

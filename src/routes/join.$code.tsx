import { createFileRoute, redirect, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/join/$code")({
  beforeLoad: ({ params }) => {
    const code = (params?.code || "").trim().toUpperCase();
    throw redirect({
      to: "/",
      search: { invite: code },
    });
  },
  component: JoinRedirectComponent,
});

function JoinRedirectComponent() {
  const params = useParams({ from: "/join/$code" });
  const navigate = useNavigate();

  useEffect(() => {
    const code = (params?.code || "").trim().toUpperCase();
    if (typeof window !== "undefined") {
      window.location.replace(`/?invite=${encodeURIComponent(code)}`);
    } else {
      void navigate({ to: "/", search: { invite: code } });
    }
  }, [navigate, params?.code]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
      <p className="text-sm font-semibold text-foreground">Entering StreamCore Community…</p>
      <p className="text-xs text-muted-foreground mt-1">Connecting to creator network preview</p>
    </div>
  );
}

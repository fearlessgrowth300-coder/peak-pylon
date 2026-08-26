import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ channelUrl: z.string().url() });

function twitchLogin(channelUrl: string) {
  const url = new URL(channelUrl);
  if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) throw new Error("Use a twitch.tv channel URL");
  const login = url.pathname.split("/").filter(Boolean)[0]?.replace(/^@/, "");
  if (!login) throw new Error("Add a Twitch channel name to the URL");
  return login;
}

export const getTwitchChannel = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }) => {
    const clientId = process.env["TWITCH_CLIENT_ID"];
    const clientSecret = process.env["TWITCH_CLIENT_SECRET"];
    if (!clientId || !clientSecret) throw new Error("Twitch credentials are not configured");

    const login = twitchLogin(data.channelUrl);
    const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!tokenResponse.ok) throw new Error("Twitch authorization failed");
    const token = (await tokenResponse.json()) as { access_token?: string };
    if (!token.access_token) throw new Error("Twitch did not return an access token");

    const headers = { "Client-Id": clientId, Authorization: `Bearer ${token.access_token}` };
    const [userResponse, streamResponse] = await Promise.all([
      fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers }),
      fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, { headers }),
    ]);
    if (!userResponse.ok) throw new Error("Twitch profile lookup failed");
    const users = (await userResponse.json()) as { data?: Array<{ display_name: string; login: string; description: string; profile_image_url: string; offline_image_url: string }> };
    const user = users.data?.[0];
    if (!user) throw new Error("Twitch channel not found");
    const streams = streamResponse.ok
      ? ((await streamResponse.json()) as {
          data?: Array<{ title?: string; game_name?: string; thumbnail_url?: string }>;
        })
      : { data: [] };
    const stream = streams.data?.[0];
    const liveBanner = stream?.thumbnail_url?.replace("{width}", "1280").replace("{height}", "720") ?? "";
    const fallbackBio = stream?.title
      ? `${stream.game_name ? `${stream.game_name} · ` : ""}${stream.title}`
      : "";
    return {
      name: user.display_name,
      handle: `@${user.login}`,
      bio: user.description || fallbackBio,
      avatar: user.profile_image_url ?? "",
      banner: user.offline_image_url || liveBanner,
      status: stream ? "live" : "offline",
      platform: "Twitch",
    };
  });

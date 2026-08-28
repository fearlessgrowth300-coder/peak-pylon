import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const resendEmailInput = z.object({
  apiKey: z.string().optional(),
  from: z.string().min(1),
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
});

export const sendResendEmailServer = createServerFn({ method: "POST" })
  .validator(resendEmailInput)
  .handler(async ({ data }) => {
    const apiKey = data.apiKey?.trim() || process.env["RESEND_API_KEY"] || "";
    if (!apiKey) {
      return {
        success: false,
        error: "No Resend API Key provided. Please paste your Resend API Key in Control Center Section 09.",
      };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: data.from,
          to: data.to,
          subject: data.subject,
          html: data.html,
          text: data.text || data.subject,
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        return {
          success: false,
          error: resData?.message || `HTTP ${response.status} from Resend`,
        };
      }

      return {
        success: true,
        id: resData?.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect to Resend API server",
      };
    }
  });

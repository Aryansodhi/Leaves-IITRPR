import nodemailer, { type Transporter } from "nodemailer";
import { env, emailTransportConfigured } from "@/env";

let transport: Transporter | null = null;

const getTransport = () => {
  if (!emailTransportConfigured) {
    return null;
  }

  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.EMAIL_SERVER_HOST,
      port: env.EMAIL_SERVER_PORT,
      secure: env.EMAIL_SERVER_PORT === 465,
      auth: {
        user: env.EMAIL_SERVER_USER,
        pass: env.EMAIL_SERVER_PASSWORD,
      },
    });
  }

  return transport;
};

const buildOtpHtml = (code: string, expiresInMinutes: number) => `
  <table style="font-family: 'Helvetica Neue', Arial, sans-serif; width: 100%; background: #f8fafc; padding: 32px 0;">
    <tr>
      <td>
        <table style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px;">
          <tr>
            <td style="font-size: 22px; font-weight: 600; color: #111827;">LeaveFlow OTP</td>
          </tr>
          <tr>
            <td style="padding-top: 12px; font-size: 16px; color: #334155;">
              Use the one-time passcode below to continue signing in.
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 0; text-align: center;">
              <div style="display: inline-block; letter-spacing: 16px; font-size: 42px; font-weight: 700; color: #0f172a;">
                ${code}
              </div>
            </td>
          </tr>
          <tr>
            <td style="font-size: 14px; color: #475569;">
              The code expires in ${expiresInMinutes} minutes. If you did not request it, please ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
`;

export const sendOtpEmail = async (to: string, code: string) => {
  if (!emailTransportConfigured) {
    console.info(`[OTP] ${to} -> ${code}`);
    return { mocked: true } as const;
  }

  const transporter = getTransport();
  if (!transporter) {
    throw new Error("Mail transport is not configured correctly.");
  }

  await transporter.sendMail({
    to,
    from: env.EMAIL_FROM,
    subject: "Your IIT Ropar leave portal code",
    html: buildOtpHtml(code, env.OTP_EXP_MINUTES),
  });

  return { mocked: false } as const;
};

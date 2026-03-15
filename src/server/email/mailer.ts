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

const formatDate = (value?: string | Date | null) => {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const humanizeStatus = (value?: string | null) => {
  if (!value) return "-";
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolveStatusColor = (value?: string | null) => {
  const normalized = (value ?? "").toUpperCase();
  if (normalized === "APPROVED") return "#16a34a";
  if (normalized === "REJECTED") return "#dc2626";
  if (normalized === "UNDER_REVIEW") return "#2563eb";
  if (normalized === "SUBMITTED") return "#0f766e";
  return "#475569";
};

type LeaveEmailDetails = {
  to: string;
  applicantName: string;
  referenceCode: string;
  leaveType: string;
  status: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  totalDays?: number | null;
  actionLabel: string;
  actionBy?: string | null;
  remarks?: string | null;
};

const buildLeaveEmailHtml = (details: LeaveEmailDetails) => {
  const portalUrl = env.NEXT_PUBLIC_APP_URL;
  const statusColor = resolveStatusColor(details.status);
  const totalDays =
    typeof details.totalDays === "number" ? `${details.totalDays}` : "-";

  return `
  <table style="font-family: 'Helvetica Neue', Arial, sans-serif; width: 100%; background: #f8fafc; padding: 32px 0;">
    <tr>
      <td>
        <table style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 40px;">
          <tr>
            <td style="font-size: 22px; font-weight: 700; color: #0f172a;">
              IIT Ropar Leave Portal
            </td>
          </tr>
          <tr>
            <td style="padding-top: 6px; font-size: 14px; color: #64748b;">
              ${details.actionLabel}
            </td>
          </tr>
          <tr>
            <td style="padding-top: 18px; font-size: 16px; color: #334155;">
              Hello ${details.applicantName}, your leave request update is ready.
            </td>
          </tr>
          <tr>
            <td style="padding-top: 18px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; font-size: 13px; color: #64748b;">Reference</td>
                  <td style="padding: 10px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${details.referenceCode}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-size: 13px; color: #64748b;">Leave type</td>
                  <td style="padding: 10px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${details.leaveType}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-size: 13px; color: #64748b;">Leave window</td>
                  <td style="padding: 10px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${formatDate(details.startDate)} - ${formatDate(details.endDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-size: 13px; color: #64748b;">Total days</td>
                  <td style="padding: 10px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${totalDays}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-size: 13px; color: #64748b;">Status</td>
                  <td style="padding: 10px 0; font-size: 13px; color: ${statusColor}; font-weight: 700; text-align: right;">${humanizeStatus(details.status)}</td>
                </tr>
                ${
                  details.actionBy
                    ? `
                <tr>
                  <td style="padding: 10px 0; font-size: 13px; color: #64748b;">Updated by</td>
                  <td style="padding: 10px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${details.actionBy}</td>
                </tr>`
                    : ""
                }
                ${
                  details.remarks
                    ? `
                <tr>
                  <td style="padding: 10px 0; font-size: 13px; color: #64748b;">Remarks</td>
                  <td style="padding: 10px 0; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">${details.remarks}</td>
                </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <a href="${portalUrl}" style="background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 999px; font-size: 13px; font-weight: 600; display: inline-block;">
                Open Leave Portal
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
              If you did not initiate this request, please contact the admin team immediately.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  `;
};

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

export const sendLeaveSubmissionEmail = async (details: LeaveEmailDetails) => {
  if (!emailTransportConfigured) {
    console.info(
      `[Leave Submission] ${details.to} -> ${details.referenceCode}`,
    );
    return { mocked: true } as const;
  }

  const transporter = getTransport();
  if (!transporter) {
    throw new Error("Mail transport is not configured correctly.");
  }

  await transporter.sendMail({
    to: details.to,
    from: env.EMAIL_FROM,
    subject: `Leave request submitted: ${details.referenceCode}`,
    html: buildLeaveEmailHtml(details),
  });

  return { mocked: false } as const;
};

export const sendLeaveStatusUpdateEmail = async (
  details: LeaveEmailDetails,
) => {
  if (!emailTransportConfigured) {
    console.info(`[Leave Status] ${details.to} -> ${details.referenceCode}`);
    return { mocked: true } as const;
  }

  const transporter = getTransport();
  if (!transporter) {
    throw new Error("Mail transport is not configured correctly.");
  }

  await transporter.sendMail({
    to: details.to,
    from: env.EMAIL_FROM,
    subject: `Leave request updated: ${details.referenceCode}`,
    html: buildLeaveEmailHtml(details),
  });

  return { mocked: false } as const;
};

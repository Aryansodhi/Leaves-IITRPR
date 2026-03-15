"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type SignaturePad from "signature_pad";

import { Button } from "@/components/ui/button";

export type SignaturePoint = {
  x: number;
  y: number;
  time: number;
};

export type SignatureStroke = {
  points: SignaturePoint[];
  color?: string;
};

export type SignatureCapture = {
  animation: SignatureStroke[];
  image: string;
};

export const SignatureOtpVerificationCard = ({
  otpEmail,
  otpCode,
  onOtpCodeChange,
  otpStatusMessage,
  isSendingOtp,
  isVerifyingOtp,
  isSubmitting,
  onSendOtp,
  onVerifyOtp,
  onSignatureChange,
  isOtpVerified,
}: {
  otpEmail: string;
  otpCode: string;
  onOtpCodeChange: (value: string) => void;
  otpStatusMessage: string | null;
  isSendingOtp: boolean;
  isVerifyingOtp: boolean;
  isSubmitting: boolean;
  onSendOtp: () => Promise<void>;
  onVerifyOtp: () => Promise<void>;
  onSignatureChange: (capture: SignatureCapture | null) => void;
  isOtpVerified: boolean;
}) => {
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signatureReady, setSignatureReady] = useState(false);
  const [showOtpEntry, setShowOtpEntry] = useState(false);

  const canSubmitOtp = otpCode.trim().length === 6;
  const disablePrimaryActions = isSubmitting || isSendingOtp || isVerifyingOtp;

  const otpStatusClass = useMemo(() => {
    const msg = otpStatusMessage?.toLowerCase() ?? "";
    if (msg.includes("verified")) return "text-green-700";
    if (
      msg.includes("unable") ||
      msg.includes("incorrect") ||
      msg.includes("expired")
    ) {
      return "text-rose-700";
    }
    return "text-slate-600";
  }, [otpStatusMessage]);

  const handleSignatureChange = (capture: SignatureCapture | null) => {
    setSignatureReady(Boolean(capture));
    setShowOtpEntry(false);
    onOtpCodeChange("");
    onSignatureChange(capture);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-4 shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            Digital Signature
          </p>
          <p className="text-xs text-slate-500">
            Click Digital Signature to open the pad. Sign first, then verify via
            OTP.
          </p>
        </div>

        {!showSignaturePad ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowSignaturePad(true)}
            className="px-3 text-xs"
            disabled={isSubmitting}
          >
            Digital Signature
          </Button>
        ) : (
          <div className="space-y-3">
            <SignaturePadField onSignatureChange={handleSignatureChange} />
            {signatureReady ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowOtpEntry(true);
                  void onSendOtp();
                }}
                disabled={disablePrimaryActions || isOtpVerified}
                className="px-3 text-xs"
              >
                {isOtpVerified
                  ? "Verified"
                  : isSendingOtp
                    ? "Sending OTP..."
                    : "Verify"}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {showOtpEntry ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50 p-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              OTP Verification
            </p>
            <p className="text-xs text-slate-500">
              OTP sent to {otpEmail || "your institute email"}. Enter code and
              submit to verify.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(event) =>
                onOtpCodeChange(event.target.value.replace(/\D/g, ""))
              }
              placeholder="Enter 6-digit OTP"
              className="w-44 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-600 focus:outline-none"
              disabled={disablePrimaryActions || isOtpVerified}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void onSendOtp();
              }}
              disabled={disablePrimaryActions || isOtpVerified}
              className="px-3 text-xs"
            >
              {isSendingOtp ? "Sending OTP..." : "Resend OTP"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void onVerifyOtp();
              }}
              className="px-3 text-xs"
              disabled={!canSubmitOtp || disablePrimaryActions || isOtpVerified}
            >
              {isOtpVerified
                ? "OTP Verified"
                : isVerifyingOtp
                  ? "Verifying..."
                  : "Submit"}
            </Button>
          </div>

          {otpStatusMessage ? (
            <p className={`text-xs ${otpStatusClass}`}>{otpStatusMessage}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const SignaturePadField = ({
  onSignatureChange,
}: {
  onSignatureChange: (capture: SignatureCapture | null) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    let mounted = true;

    const setupPad = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !mounted) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.floor(bounds.width * ratio);
      canvas.height = Math.floor(180 * ratio);

      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);

      const { default: SignaturePadCtor } = await import("signature_pad");
      if (!mounted) return;

      const pad = new SignaturePadCtor(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(15, 23, 42)",
      });

      const emitCapture = () => {
        if (pad.isEmpty()) {
          onSignatureChange(null);
          return;
        }

        const animation = pad.toData() as SignatureStroke[];
        const image = pad.toDataURL("image/png");
        onSignatureChange({ animation, image });
      };

      pad.addEventListener("endStroke", emitCapture);
      signaturePadRef.current = pad;
    };

    void setupPad();

    return () => {
      mounted = false;
      signaturePadRef.current?.off();
      signaturePadRef.current = null;
      onSignatureChange(null);
    };
  }, [onSignatureChange]);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-45 w-full touch-none rounded-md border border-dashed border-slate-400 bg-white"
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          className="px-2 text-xs"
          onClick={() => {
            signaturePadRef.current?.clear();
            onSignatureChange(null);
          }}
        >
          Clear signature
        </Button>
      </div>
    </div>
  );
};

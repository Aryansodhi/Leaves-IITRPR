"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CirclePlay, PenLine, ShieldCheck } from "lucide-react";
import Image from "next/image";
import type SignaturePad from "signature_pad";

import { Button } from "@/components/ui/button";
import {
  getSessionEncryptionPassword,
  loadDecryptedItem,
  removeItem,
  saveEncryptedItem,
} from "@/lib/encrypted-local-storage";

export type SignatureMode = "digital" | "upload" | "typed";

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

const SIGNATURE_STORAGE_KEY = (scope: string) =>
  `lf-signature-capture-v1:${scope || "global"}`;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read signature file."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read signature file."));
    };
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load signature image."));
    img.src = src;
  });

const convertImageToPngDataUrl = async (file: File) => {
  const inputDataUrl = await readFileAsDataUrl(file);
  if (inputDataUrl.startsWith("data:image/png;base64,")) return inputDataUrl;

  const img = await loadImage(inputDataUrl);
  const canvas = document.createElement("canvas");
  const width = 560;
  const height = 180;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to process signature image.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const padding = 18;
  const targetWidth = Math.max(width - padding * 2, 1);
  const targetHeight = Math.max(height - padding * 2, 1);
  const scale = Math.min(
    targetWidth / Math.max(img.width, 1),
    targetHeight / Math.max(img.height, 1),
  );
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;

  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
  return canvas.toDataURL("image/png");
};

const buildPlaceholderAnimation = (): SignatureStroke[] => [
  {
    points: [{ x: 0, y: 0, time: Date.now() }],
    color: "rgb(15, 23, 42)",
  },
];

const renderTypedSignatureToCapture = (value: string): SignatureCapture => {
  const canvas = document.createElement("canvas");
  const width = 560;
  const height = 180;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      animation: buildPlaceholderAnimation(),
      image:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5qU8cAAAAASUVORK5CYII=",
    };
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font =
    "48px 'Segoe Script','Brush Script MT','Lucida Handwriting',cursive";
  const safe = value.trim().slice(0, 80);
  ctx.fillText(safe, width / 2, height / 2);

  return {
    animation: buildPlaceholderAnimation(),
    image: canvas.toDataURL("image/png"),
  };
};

export const SignatureOtpVerificationCard = ({
  storageScope,
  signatureMode,
  onSignatureModeChange,
  typedSignature,
  onTypedSignatureChange,
  requireOtpForTyped = false,
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
  storageScope: string;
  signatureMode: SignatureMode;
  onSignatureModeChange: (mode: SignatureMode) => void;
  typedSignature: string;
  onTypedSignatureChange: (value: string) => void;
  requireOtpForTyped?: boolean;
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
  const [signatureCapture, setSignatureCapture] =
    useState<SignatureCapture | null>(null);
  const [showReplay, setShowReplay] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [encryptionPassword] = useState(() => getSessionEncryptionPassword());

  const isTypedMode = signatureMode === "typed";
  const isDigitalLike = !isTypedMode || requireOtpForTyped;
  const isPadMode = signatureMode === "digital";
  const isUploadMode = signatureMode === "upload";

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

  const handleSignatureChange = useCallback(
    (capture: SignatureCapture | null) => {
      setSignatureCapture(capture);
      setSignatureReady(Boolean(capture));
      setShowOtpEntry(false);
      setShowReplay(false);
      setUploadError(null);
      onOtpCodeChange("");
      onSignatureChange(capture);
      if (capture) {
        void saveEncryptedItem(
          SIGNATURE_STORAGE_KEY(storageScope),
          encryptionPassword,
          JSON.stringify(capture),
        );
      } else {
        removeItem(SIGNATURE_STORAGE_KEY(storageScope));
      }
    },
    [encryptionPassword, onOtpCodeChange, onSignatureChange, storageScope],
  );

  const canReplay = useMemo(() => {
    if (!signatureCapture?.animation?.length) return false;
    return signatureCapture.animation.some(
      (stroke) => stroke.points.length > 1,
    );
  }, [signatureCapture]);

  useEffect(() => {
    if (!isDigitalLike) return;
    if (signatureCapture) return;

    let mounted = true;
    const restore = async () => {
      const raw = await loadDecryptedItem(
        SIGNATURE_STORAGE_KEY(storageScope),
        encryptionPassword,
      );
      if (!mounted || !raw) return;

      try {
        const parsed = JSON.parse(raw) as SignatureCapture;
        if (!parsed?.image || typeof parsed.image !== "string") return;
        if (!parsed.image.startsWith("data:image/png;base64,")) return;
        if (!Array.isArray(parsed.animation) || parsed.animation.length === 0)
          return;
        handleSignatureChange(parsed);
        setShowSignaturePad(true);
      } catch {
        // ignore
      }
    };

    void restore();
    return () => {
      mounted = false;
    };
  }, [
    encryptionPassword,
    handleSignatureChange,
    isDigitalLike,
    signatureCapture,
    storageScope,
  ]);

  const handleUploadClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleUploadFile = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Signature file is too large. Use a file under 5MB.");
      return;
    }

    try {
      setUploadError(null);
      const pngDataUrl = await convertImageToPngDataUrl(file);
      setShowSignaturePad(false);
      handleSignatureChange({
        animation: buildPlaceholderAnimation(),
        image: pngDataUrl,
      });
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Unable to process signature file.",
      );
    }
  };

  const switchMode = (mode: SignatureMode) => {
    onSignatureModeChange(mode);
    setShowOtpEntry(false);
    setShowReplay(false);
    setUploadError(null);

    if (mode === "digital") {
      setShowSignaturePad(true);
    } else {
      setShowSignaturePad(false);
    }

    if (mode === "typed" && requireOtpForTyped) {
      const next = typedSignature.trim();
      handleSignatureChange(next ? renderTypedSignatureToCapture(next) : null);
      return;
    }

    handleSignatureChange(null);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-cyan-200/70 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.18),transparent_45%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_38%),linear-gradient(145deg,#f8fbff_0%,#eff8ff_48%,#f9fffb_100%)] p-4 shadow-[0_16px_45px_-34px_rgba(14,116,144,0.75)] sm:p-5">
      <div className="space-y-3 rounded-xl border border-cyan-200/80 bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
              <span className="inline-flex items-center gap-1.5">
                <PenLine className="h-3.5 w-3.5" />
                Digital Signature
              </span>
            </p>
            <p className="text-xs text-slate-600">
              Sign below, send OTP, and verify. Once verified, your signature is
              locked for submission.
            </p>
          </div>
          <div className="rounded-full border border-cyan-300/80 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
            Secure step
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="signatureMode"
              value="digital"
              checked={signatureMode === "digital"}
              onChange={() => switchMode("digital")}
              className="h-4 w-4"
              disabled={isSubmitting}
            />
            Digital signature pad
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="signatureMode"
              value="upload"
              checked={signatureMode === "upload"}
              onChange={() => switchMode("upload")}
              className="h-4 w-4"
              disabled={isSubmitting}
            />
            Upload signature image
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="signatureMode"
              value="typed"
              checked={signatureMode === "typed"}
              onChange={() => switchMode("typed")}
              className="h-4 w-4"
              disabled={isSubmitting}
            />
            Type signature using keyboard
          </label>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            void handleUploadFile(file);
          }}
        />

        {isTypedMode ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              Typed signature
            </label>
            <input
              type="text"
              value={typedSignature}
              onChange={(event) => {
                const next = event.target.value;
                onTypedSignatureChange(next);
                if (!requireOtpForTyped) return;
                handleSignatureChange(
                  next.trim() ? renderTypedSignatureToCapture(next) : null,
                );
              }}
              placeholder="Type your full name"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none"
              disabled={isSubmitting}
            />
          </div>
        ) : isPadMode ? (
          <div className="space-y-3">
            {showSignaturePad ? (
              <SignaturePadField onSignatureChange={handleSignatureChange} />
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowSignaturePad(true)}
                className="h-9 px-4 text-xs font-semibold text-cyan-900"
                disabled={isSubmitting}
              >
                Open Digital Signature Pad
              </Button>
            )}
          </div>
        ) : isUploadMode ? (
          <div className="space-y-3">
            {!signatureCapture ? (
              <Button
                type="button"
                variant="secondary"
                onClick={handleUploadClick}
                className="h-9 px-4 text-xs font-semibold"
                disabled={isSubmitting}
              >
                Choose signature file
              </Button>
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                  Uploaded signature preview
                </p>
                <Image
                  src={signatureCapture.image}
                  alt="Uploaded signature"
                  width={560}
                  height={180}
                  unoptimized
                  className="h-32 w-full rounded-md border border-slate-200 bg-white object-contain"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 text-xs"
                    onClick={handleUploadClick}
                    disabled={isSubmitting}
                  >
                    Change file
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 text-xs"
                    onClick={() => handleSignatureChange(null)}
                    disabled={isSubmitting}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
            {uploadError ? (
              <p className="text-xs text-rose-700">{uploadError}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-slate-600">
              Choose a signature mode above.
            </div>
          </div>
        )}

        {isDigitalLike && signatureReady ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowOtpEntry(true);
                void onSendOtp();
              }}
              disabled={disablePrimaryActions || isOtpVerified}
              className="h-9 px-4 text-xs font-semibold"
            >
              {isOtpVerified
                ? "Verified"
                : isSendingOtp
                  ? "Sending OTP..."
                  : "Verify via OTP"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowReplay(true)}
              className="h-9 px-2 text-xs text-slate-700"
              disabled={!signatureCapture || !canReplay || !isPadMode}
            >
              <CirclePlay className="mr-1.5 h-3.5 w-3.5" />
              Playback
            </Button>

            {isOtpVerified ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-green-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Signature Verified
              </span>
            ) : null}
          </div>
        ) : null}

        {showReplay && signatureCapture && isPadMode ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="relative w-full max-w-md rounded-xl border border-cyan-200 bg-white p-6 shadow-2xl">
              <button
                type="button"
                aria-label="Close playback"
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-800"
                onClick={() => setShowReplay(false)}
              >
                <span aria-hidden="true">&times;</span>
              </button>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">
                Signature Playback
              </p>
              <SignaturePlaybackCanvas animation={signatureCapture.animation} />
            </div>
          </div>
        ) : null}
      </div>

      {isDigitalLike && showOtpEntry ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-white/85 p-4 backdrop-blur-sm">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                OTP Verification
              </span>
            </p>
            <p className="text-xs text-slate-600">
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
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              onChange={(event) =>
                onOtpCodeChange(event.target.value.replace(/\D/g, ""))
              }
              placeholder="Enter 6-digit OTP"
              className="w-44 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              disabled={disablePrimaryActions || isOtpVerified}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void onSendOtp();
              }}
              disabled={disablePrimaryActions || isOtpVerified}
              className="h-9 px-3 text-xs"
            >
              {isSendingOtp ? "Sending OTP..." : "Resend OTP"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void onVerifyOtp();
              }}
              className="h-9 px-3 text-xs"
              disabled={!canSubmitOtp || disablePrimaryActions || isOtpVerified}
            >
              {isOtpVerified
                ? "OTP Verified"
                : isVerifyingOtp
                  ? "Verifying..."
                  : "Submit OTP"}
            </Button>
          </div>

          {otpStatusMessage ? (
            <p className={`text-xs ${otpStatusClass}`}>{otpStatusMessage}</p>
          ) : null}

          {signatureCapture ? (
            <div className="space-y-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                Captured signature preview
              </p>
              <Image
                src={signatureCapture.image}
                alt="Captured digital signature"
                width={560}
                height={96}
                unoptimized
                className="h-24 w-full rounded-md border border-emerald-200 bg-white object-contain"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const SignaturePlaybackCanvas = ({
  animation,
}: {
  animation: SignatureStroke[];
}) => {
  const replayCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = replayCanvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(Math.floor(bounds.width), 200);
    const height = 120;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.scale(ratio, ratio);

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";

    const segments: Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      t: number;
      color: string;
    }> = [];
    const allPoints: Array<{ x: number; y: number }> = [];

    animation.forEach((stroke) => {
      const color = stroke.color ?? "rgb(15, 23, 42)";
      stroke.points.forEach((point) => {
        allPoints.push({ x: point.x, y: point.y });
      });
      for (let index = 1; index < stroke.points.length; index += 1) {
        const prev = stroke.points[index - 1];
        const next = stroke.points[index];
        segments.push({
          x1: prev.x,
          y1: prev.y,
          x2: next.x,
          y2: next.y,
          t: next.time,
          color,
        });
      }
    });

    if (segments.length === 0) return;

    const minX = Math.min(...allPoints.map((point) => point.x));
    const maxX = Math.max(...allPoints.map((point) => point.x));
    const minY = Math.min(...allPoints.map((point) => point.y));
    const maxY = Math.max(...allPoints.map((point) => point.y));
    const sourceWidth = Math.max(maxX - minX, 1);
    const sourceHeight = Math.max(maxY - minY, 1);
    const padding = 10;
    const targetWidth = Math.max(width - padding * 2, 1);
    const targetHeight = Math.max(height - padding * 2, 1);
    const scale = Math.min(
      targetWidth / sourceWidth,
      targetHeight / sourceHeight,
    );
    const offsetX = (width - sourceWidth * scale) / 2;
    const offsetY = (height - sourceHeight * scale) / 2;

    const projectX = (value: number) => (value - minX) * scale + offsetX;
    const projectY = (value: number) => (value - minY) * scale + offsetY;

    const minTime = segments[0]?.t ?? 0;
    const maxTime = segments[segments.length - 1]?.t ?? minTime;
    const totalDuration = Math.max(maxTime - minTime, 480);

    let segmentIndex = 0;
    let rafId = 0;
    const startedAt = performance.now();

    const draw = (now: number) => {
      const elapsed = (now - startedAt) * 1.8;
      const replayTime = minTime + Math.min(elapsed, totalDuration);

      while (
        segmentIndex < segments.length &&
        segments[segmentIndex] &&
        segments[segmentIndex].t <= replayTime
      ) {
        const segment = segments[segmentIndex];
        context.strokeStyle = segment.color;
        context.beginPath();
        context.moveTo(projectX(segment.x1), projectY(segment.y1));
        context.lineTo(projectX(segment.x2), projectY(segment.y2));
        context.stroke();
        segmentIndex += 1;
      }

      if (segmentIndex < segments.length) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    rafId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [animation]);

  return (
    <canvas
      ref={replayCanvasRef}
      className="h-30 w-full rounded-md border border-dashed border-cyan-300 bg-white"
    />
  );
};

const SignaturePadField = ({
  onSignatureChange,
}: {
  onSignatureChange: (capture: SignatureCapture | null) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const onSignatureChangeRef = useRef(onSignatureChange);

  useEffect(() => {
    onSignatureChangeRef.current = onSignatureChange;
  }, [onSignatureChange]);

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
          onSignatureChangeRef.current(null);
          return;
        }

        const animation = pad.toData() as SignatureStroke[];
        const image = pad.toDataURL("image/png");
        onSignatureChangeRef.current({ animation, image });
      };

      pad.addEventListener("endStroke", emitCapture);
      signaturePadRef.current = pad;
    };

    void setupPad();

    return () => {
      mounted = false;
      signaturePadRef.current?.off();
      signaturePadRef.current = null;
      onSignatureChangeRef.current(null);
    };
  }, []);

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
            onSignatureChangeRef.current(null);
          }}
        >
          Clear signature
        </Button>
      </div>
    </div>
  );
};

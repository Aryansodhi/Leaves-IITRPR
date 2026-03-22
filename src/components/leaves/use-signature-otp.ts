import { useCallback, useState } from "react";

import type {
  SignatureCapture,
  SignatureMode,
} from "@/components/leaves/signature-otp-verification-card";

type UseSignatureOtpOptions = {
  enableTyped?: boolean;
};

type ReadyMessages = {
  typed?: string;
  digital?: string;
};

export const DIGITAL_SIGNATURE_VALUE = "DIGITALLY_SIGNED";

export const useSignatureOtp = ({
  enableTyped = true,
}: UseSignatureOtpOptions = {}) => {
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStatusMessage, setOtpStatusMessage] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>("digital");
  const [typedSignature, setTypedSignature] = useState("");
  const [signatureCapture, setSignatureCapture] =
    useState<SignatureCapture | null>(null);

  const clearOtpState = useCallback(() => {
    setOtpCode("");
    setOtpStatusMessage(null);
    setIsOtpVerified(false);
  }, []);

  const onSignatureModeChange = useCallback(
    (mode: SignatureMode) => {
      if (!enableTyped && mode === "typed") return;
      setSignatureMode(mode);
      clearOtpState();
      if (mode === "typed") {
        setSignatureCapture(null);
      }
    },
    [clearOtpState, enableTyped],
  );

  const onTypedSignatureChange = useCallback((value: string) => {
    setTypedSignature(value);
    setOtpStatusMessage(null);
    setIsOtpVerified(false);
  }, []);

  const onSignatureChange = useCallback((capture: SignatureCapture | null) => {
    setSignatureCapture(capture);
    setOtpStatusMessage(null);
    setIsOtpVerified(false);
  }, []);

  const ensureReadyForSubmit = useCallback(
    (messages?: ReadyMessages) => {
      if (signatureMode === "typed") {
        if (!typedSignature.trim()) {
          return (
            messages?.typed ?? "Please type your signature before submitting."
          );
        }
        return null;
      }

      if (!isOtpVerified || !signatureCapture) {
        return (
          messages?.digital ??
          "Please complete signature capture and OTP verification before submitting."
        );
      }

      return null;
    },
    [isOtpVerified, signatureCapture, signatureMode, typedSignature],
  );

  const handleVerifyOtp = useCallback(async () => {
    if (signatureMode === "typed") {
      setOtpStatusMessage(
        "OTP verification is not required when using typed signature mode.",
      );
      setIsOtpVerified(false);
      return;
    }

    if (!signatureCapture) {
      setOtpStatusMessage(
        "Please add your digital signature before OTP verification.",
      );
      setIsOtpVerified(false);
      return;
    }

    if (!otpEmail.trim()) {
      setOtpStatusMessage(
        "Unable to resolve your institute email for OTP verification.",
      );
      setIsOtpVerified(false);
      return;
    }

    if (otpCode.trim().length !== 6) {
      setOtpStatusMessage("Enter a valid 6-digit OTP.");
      setIsOtpVerified(false);
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, code: otpCode.trim() }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to verify OTP.");
      }

      setIsOtpVerified(true);
      setOtpStatusMessage("OTP verified successfully.");
    } catch (err) {
      setIsOtpVerified(false);
      setOtpStatusMessage(
        err instanceof Error ? err.message : "Unable to verify OTP.",
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  }, [otpCode, otpEmail, signatureCapture, signatureMode]);

  const handleSendOtp = useCallback(async () => {
    if (signatureMode === "typed") {
      setOtpStatusMessage(
        "OTP is not required when using typed signature mode.",
      );
      return;
    }

    if (!otpEmail.trim()) {
      setOtpStatusMessage("Unable to resolve your institute email for OTP.");
      return;
    }

    setIsSendingOtp(true);
    setOtpStatusMessage(null);
    try {
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "Unable to send OTP.");
      }

      setOtpStatusMessage(result.message ?? "OTP sent to your email.");
    } catch (err) {
      setOtpStatusMessage(
        err instanceof Error ? err.message : "Unable to send OTP.",
      );
    } finally {
      setIsSendingOtp(false);
    }
  }, [otpEmail, signatureMode]);

  const resetAfterSubmit = useCallback(
    (options?: { clearSignature?: boolean }) => {
      clearOtpState();
      if (options?.clearSignature ?? true) {
        setSignatureCapture(null);
      }
    },
    [clearOtpState],
  );

  return {
    otpEmail,
    setOtpEmail,
    otpCode,
    setOtpCode,
    otpStatusMessage,
    isSendingOtp,
    isVerifyingOtp,
    isOtpVerified,
    signatureMode,
    typedSignature,
    signatureCapture,
    onSignatureModeChange,
    onTypedSignatureChange,
    onSignatureChange,
    ensureReadyForSubmit,
    handleSendOtp,
    handleVerifyOtp,
    resetAfterSubmit,
  };
};

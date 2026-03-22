"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearAutofillProfileCache } from "@/lib/form-autofill";
import {
  loadProfileAvatar,
  removeProfileAvatar,
  saveProfileAvatar,
} from "@/lib/profile-avatar";

type ProfileResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    userId: string;
    name: string;
    email: string;
    roleKey: string;
    roleSlug: string;
    department: string;
    designation: string;
    employeeCode: string;
    phone: string;
  };
};

type ProfileUpdateResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    userId: string;
    phone: string;
  };
};

const getInitials = (name: string) => {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${second}`.toUpperCase() || "?";
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read image file."));
    };
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load selected image."));
    img.src = src;
  });

const cropToSquareAvatar = async (file: File) => {
  const input = await readFileAsDataUrl(file);
  const img = await loadImage(input);

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to process image.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const srcSize = Math.min(img.width, img.height);
  const sx = (img.width - srcSize) / 2;
  const sy = (img.height - srcSize) / 2;

  ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.9);
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200/80 px-4 py-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-1 text-sm font-semibold text-slate-900">
      {value || "Not available"}
    </p>
  </div>
);

export const ProfileDetailsCard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileResponse["data"] | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneEditing, setPhoneEditing] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/forms/autofill", {
          method: "GET",
          cache: "no-store",
        });
        const result = (await response.json()) as ProfileResponse;

        if (!response.ok || !result.ok || !result.data) {
          throw new Error(result.message ?? "Unable to load profile.");
        }

        setProfile(result.data);
        setPhoneDraft(result.data.phone ?? "");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load profile.",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  useEffect(() => {
    if (!profile?.userId) return;
    setAvatarDataUrl(loadProfileAvatar(profile.userId));
  }, [profile?.userId]);

  const handleAvatarUpload = async (file: File | null) => {
    if (!profile?.userId) return;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Please upload a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Image is too large. Please use a file under 5MB.");
      return;
    }

    try {
      setAvatarBusy(true);
      setAvatarError(null);
      const dataUrl = await cropToSquareAvatar(file);
      saveProfileAvatar(profile.userId, dataUrl);
      setAvatarDataUrl(dataUrl);
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "Unable to process image.",
      );
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAvatarRemove = () => {
    if (!profile?.userId) return;
    removeProfileAvatar(profile.userId);
    setAvatarDataUrl(null);
    setAvatarError(null);
  };

  const handlePhoneSave = async () => {
    if (!profile?.userId) return;

    const digits = phoneDraft.trim().replace(/\D/g, "");
    if (digits.length !== 10) {
      setPhoneError("Phone number must contain exactly 10 digits.");
      return;
    }

    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      const result = (await response.json()) as ProfileUpdateResponse;
      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message ?? "Unable to update phone.");
      }

      setProfile((current) =>
        current ? { ...current, phone: result.data?.phone ?? digits } : current,
      );
      setPhoneDraft(result.data.phone);
      setPhoneEditing(false);
      clearAutofillProfileCache();
    } catch (err) {
      setPhoneError(
        err instanceof Error ? err.message : "Unable to update phone.",
      );
    } finally {
      setPhoneBusy(false);
    }
  };

  if (loading) {
    return (
      <SurfaceCard className="border-slate-200/80 p-5 text-sm text-slate-600">
        Loading profile details...
      </SurfaceCard>
    );
  }

  if (error) {
    return (
      <SurfaceCard className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {error}
      </SurfaceCard>
    );
  }

  if (!profile) return null;

  return (
    <SurfaceCard className="space-y-3 border-slate-200/80 p-5">
      <p className="text-lg font-semibold text-slate-900">Profile</p>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {avatarDataUrl ? (
              <Image
                src={avatarDataUrl}
                alt="Profile photo"
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-semibold text-slate-700">
                {getInitials(profile.name)}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {profile.name}
            </p>
            <p className="text-xs text-slate-600">{profile.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={avatarBusy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              void handleAvatarUpload(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="text-sm"
            disabled={avatarBusy}
            onClick={() => avatarInputRef.current?.click()}
          >
            {avatarDataUrl ? "Change photo" : "Add photo"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-sm"
            disabled={!avatarDataUrl || avatarBusy}
            onClick={handleAvatarRemove}
          >
            Remove
          </Button>
        </div>
      </div>

      {avatarError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {avatarError}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Row label="Name" value={profile.name} />
        <Row label="Email" value={profile.email} />
        <Row label="Role" value={profile.roleKey} />
        <Row label="Role Slug" value={profile.roleSlug} />
        <Row label="Department" value={profile.department} />
        <Row label="Designation" value={profile.designation} />
        <Row label="Employee Code" value={profile.employeeCode} />
        <div className="rounded-xl border border-slate-200/80 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Phone
              </p>
              {!phoneEditing ? (
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {profile.phone || "Not available"}
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  <Input
                    value={phoneDraft}
                    onChange={(event) => setPhoneDraft(event.target.value)}
                    placeholder="10-digit phone number"
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                  {phoneError && (
                    <p className="text-xs font-medium text-rose-700">
                      {phoneError}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="text-sm"
                      onClick={() => void handlePhoneSave()}
                      disabled={phoneBusy}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-sm"
                      onClick={() => {
                        setPhoneDraft(profile.phone ?? "");
                        setPhoneEditing(false);
                        setPhoneError(null);
                      }}
                      disabled={phoneBusy}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {!phoneEditing && (
              <Button
                type="button"
                variant="secondary"
                className="text-sm"
                onClick={() => {
                  setPhoneEditing(true);
                  setPhoneError(null);
                }}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
};

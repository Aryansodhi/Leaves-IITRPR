const AVATAR_KEY_PREFIX = "lf-profile-avatar-v1:";

export const getAvatarStorageKey = (userId: string) =>
  `${AVATAR_KEY_PREFIX}${userId || "unknown"}`;

export const loadProfileAvatar = (userId: string) => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(getAvatarStorageKey(userId));
  if (!raw) return null;
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("data:image/")) return null;
  return raw;
};

export const saveProfileAvatar = (userId: string, dataUrl: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getAvatarStorageKey(userId), dataUrl);
};

export const removeProfileAvatar = (userId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getAvatarStorageKey(userId));
};

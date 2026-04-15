export const AUTH_BROADCAST_CHANNEL = "leaveflow-auth";
export const AUTH_EVENT_STORAGE_KEY = "lf-auth-event";

type AuthEvent = {
  type: "logout";
  at: number;
};

export const broadcastLogout = () => {
  if (typeof window === "undefined") return;

  const event: AuthEvent = { type: "logout", at: Date.now() };

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
      channel.postMessage(event);
      channel.close();
      return;
    }
  } catch {
    // ignore
  }

  try {
    window.localStorage.setItem(AUTH_EVENT_STORAGE_KEY, JSON.stringify(event));
  } catch {
    // ignore
  }
};

export const parseAuthEvent = (value: string | null): AuthEvent | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AuthEvent>;
    if (parsed.type !== "logout") return null;
    if (typeof parsed.at !== "number") return null;
    return { type: "logout", at: parsed.at };
  } catch {
    return null;
  }
};

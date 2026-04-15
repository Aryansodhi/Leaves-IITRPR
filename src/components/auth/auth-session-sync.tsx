"use client";

import { useEffect } from "react";

import {
  AUTH_BROADCAST_CHANNEL,
  AUTH_EVENT_STORAGE_KEY,
  parseAuthEvent,
} from "@/lib/auth-broadcast";

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  window.location.assign("/login");
};

export const AuthSessionSync = () => {
  useEffect(() => {
    const onAuthEvent = (event: unknown) => {
      if (!event || typeof event !== "object") return;
      const type = (event as { type?: unknown }).type;
      if (type === "logout") {
        redirectToLogin();
      }
    };

    let channel: BroadcastChannel | null = null;

    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
        channel.onmessage = (message) => onAuthEvent(message.data);
      }
    } catch {
      channel = null;
    }

    const onStorage = (storageEvent: StorageEvent) => {
      if (storageEvent.key !== AUTH_EVENT_STORAGE_KEY) return;
      const parsed = parseAuthEvent(storageEvent.newValue);
      if (parsed?.type === "logout") {
        redirectToLogin();
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      if (channel) {
        try {
          channel.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return null;
};

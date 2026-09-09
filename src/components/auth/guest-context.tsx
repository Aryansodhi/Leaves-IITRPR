"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { GuestLoginModal } from "@/components/auth/guest-login-modal";

type GuestContextValue = {
  isGuest: boolean;
  promptLogin: (message?: string) => void;
};

const GuestCtx = createContext<GuestContextValue>({
  isGuest: false,
  promptLogin: () => {},
});

export const useGuest = () => useContext(GuestCtx);

export const GuestProvider = ({
  children,
  isGuest,
}: {
  children: ReactNode;
  isGuest: boolean;
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState<string | undefined>();

  const promptLogin = useCallback((message?: string) => {
    setModalMessage(message);
    setModalOpen(true);
  }, []);

  return (
    <GuestCtx.Provider value={{ isGuest, promptLogin }}>
      {children}
      {isGuest && (
        <GuestLoginModal
          open={modalOpen}
          message={modalMessage}
          onClose={() => setModalOpen(false)}
        />
      )}
    </GuestCtx.Provider>
  );
};

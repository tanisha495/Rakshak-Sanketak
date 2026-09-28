import NetInfo from "@react-native-community/netinfo";
import type { ReactNode } from "react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { isNetworkOnline, syncPendingReports } from "@/services";

interface NetworkContextValue {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
  isOnline: boolean;
  isUnknown: boolean;
  syncNow: (includeFailed?: boolean) => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<
    boolean | null | undefined
  >(undefined);
  const wasOnline = useRef<boolean | undefined>(undefined);

  const onlineState = isNetworkOnline({ isConnected, isInternetReachable });
  const isOnline = onlineState === true;
  const isUnknown = onlineState === undefined;

  const syncNow = useCallback(async (includeFailed = true) => {
    await syncPendingReports({ includeFailed });
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nextSnapshot = {
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      };
      const nextOnlineState = isNetworkOnline(nextSnapshot);

      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable);

      if (wasOnline.current === false && nextOnlineState === true) {
        syncPendingReports({ includeFailed: true });
      }

      wasOnline.current = nextOnlineState;
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && isOnline) {
        syncPendingReports({ includeFailed: true });
      }
    });

    return () => subscription.remove();
  }, [isOnline]);

  const value = useMemo(
    () => ({
      isConnected,
      isInternetReachable,
      isOnline,
      isUnknown,
      syncNow,
    }),
    [isConnected, isInternetReachable, isOnline, isUnknown, syncNow],
  );

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetworkContext() {
  const context = use(NetworkContext);

  if (!context) {
    throw new Error("useNetworkStatus must be used within NetworkProvider");
  }

  return context;
}

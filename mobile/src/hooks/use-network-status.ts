import { useNetworkContext } from "@/context/network-provider";

export function useNetworkStatus() {
  return useNetworkContext();
}

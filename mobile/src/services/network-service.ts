import NetInfo from "@react-native-community/netinfo";

export interface NetworkSnapshot {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}

export function isNetworkOnline(snapshot: NetworkSnapshot): boolean | undefined {
  if (snapshot.isConnected === false) {
    return false;
  }

  if (snapshot.isInternetReachable === false) {
    return false;
  }

  if (snapshot.isConnected === true) {
    return true;
  }

  return undefined;
}

export async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  const state = await NetInfo.fetch();

  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
  };
}

export async function getIsOnline(): Promise<boolean> {
  return isNetworkOnline(await getNetworkSnapshot()) === true;
}

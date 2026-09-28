import * as FileSystem from "expo-file-system/legacy";

export class MediaPersistenceError extends Error {
  constructor(message = "Unable to persist media.") {
    super(message);
    this.name = "MediaPersistenceError";
  }
}

type MediaType = "audio" | "photo";

const baseDirectory = `${FileSystem.documentDirectory ?? ""}sanketak/offline/`;

export async function persistMedia(
  uri: string | undefined,
  type: MediaType,
): Promise<string | undefined> {
  if (!uri) {
    return undefined;
  }

  if (uri.startsWith(baseDirectory)) {
    return uri;
  }

  if (!FileSystem.documentDirectory) {
    throw new MediaPersistenceError();
  }

  const directory = `${baseDirectory}${type === "audio" ? "audio" : "photos"}/`;
  const extension = getExtension(uri, type);
  const destination = `${directory}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${extension}`;

  try {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch {
    throw new MediaPersistenceError();
  }
}

function getExtension(uri: string, type: MediaType): string {
  const cleanUri = uri.split("?")[0] ?? uri;
  const extension = cleanUri.split(".").pop()?.toLowerCase();

  if (extension && extension.length <= 5 && !extension.includes("/")) {
    return extension;
  }

  return type === "audio" ? "m4a" : "jpg";
}

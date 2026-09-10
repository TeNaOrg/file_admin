import {apiClient} from "@/lib/api";

const STORAGE_PREFIX = "gameArchiveUpload:";

interface StoredSession {
  uploadId: string;
  fingerprint: string;
}

const fingerprintOf = (file: File) =>
  `${file.name}:${file.size}:${file.lastModified}`;

// Keyed by fingerprint so multiple in-flight/abandoned uploads (different
// files) don't clobber each other's resume state.
const storageKey = (fingerprint: string) => `${STORAGE_PREFIX}${fingerprint}`;

const loadStoredSession = (fingerprint: string): StoredSession | null => {
  try {
    const raw = localStorage.getItem(storageKey(fingerprint));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.fingerprint === fingerprint ? parsed : null;
  } catch {
    return null;
  }
};

const saveStoredSession = (session: StoredSession) => {
  try {
    localStorage.setItem(storageKey(session.fingerprint), JSON.stringify(session));
  } catch {
    // localStorage unavailable (private mode, etc.) — resume-after-reload
    // just won't work for this upload; the upload itself still proceeds.
  }
};

const clearStoredSession = (fingerprint: string) => {
  try {
    localStorage.removeItem(storageKey(fingerprint));
  } catch {
    // ignore
  }
};

export async function uploadGameArchive(
  file: File,
  onProgress: (uploadedBytes: number, totalBytes: number) => void,
  onUploadIdKnown?: (uploadId: string) => void
): Promise<string> {
  const fingerprint = fingerprintOf(file);
  let uploadId: string;
  let uploadedBytes = 0;
  let chunkSize = 5 * 1024 * 1024;

  const stored = loadStoredSession(fingerprint);
  if (stored) {
    try {
      const status = await apiClient.getGameUploadStatus(stored.uploadId);
      if (status.success && status.data.status === "in_progress") {
        uploadId = stored.uploadId;
        uploadedBytes = status.data.uploadedBytes;
      } else {
        clearStoredSession(fingerprint);
        uploadId = "";
      }
    } catch {
      // Session likely reaped by the server's cleanup cron — start fresh.
      clearStoredSession(fingerprint);
      uploadId = "";
    }
  } else {
    uploadId = "";
  }

  if (!uploadId) {
    const init = await apiClient.initGameUpload(file.name, file.size);
    uploadId = init.data.uploadId;
    chunkSize = init.data.chunkSize;
    saveStoredSession({uploadId, fingerprint});
  }

  onUploadIdKnown?.(uploadId);
  onProgress(uploadedBytes, file.size);

  while (uploadedBytes < file.size) {
    const chunk = file.slice(uploadedBytes, uploadedBytes + chunkSize);
    const startOffset = uploadedBytes;
    const result = await apiClient.uploadGameUploadChunk(
      uploadId,
      startOffset,
      chunk,
      (loaded) => onProgress(startOffset + loaded, file.size)
    );
    uploadedBytes = result.data.uploadedBytes;
    onProgress(uploadedBytes, file.size);
  }

  const complete = await apiClient.completeGameUpload(uploadId);
  clearStoredSession(fingerprint);
  return complete.data.path;
}

export async function cancelGameArchiveUpload(
  file: File,
  uploadId: string
): Promise<void> {
  await apiClient.cancelGameUpload(uploadId).catch(() => {});
  clearStoredSession(fingerprintOf(file));
}

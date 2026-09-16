export type InvitationQrScannerSession = {
  stop: () => Promise<void>;
};

let primedStreamPromise: Promise<MediaStream> | null = null;

/** Request camera access while a user gesture is still active (mobile browsers). */
export function primeInvitationQrCameraAccess(): void {
  if (!window.isSecureContext || primedStreamPromise) {
    return;
  }

  const getUserMedia = navigator.mediaDevices?.getUserMedia;
  if (!getUserMedia) {
    return;
  }

  primedStreamPromise = getUserMedia.call(navigator.mediaDevices, {
    video: { facingMode: { ideal: 'environment' } },
  });
}

/** Returns a primed stream once, for reuse by the scanner dialog. */
export async function takePrimedCameraStream(): Promise<MediaStream | null> {
  if (!primedStreamPromise) {
    return null;
  }

  const promise = primedStreamPromise;
  primedStreamPromise = null;

  try {
    return await promise;
  } catch {
    return null;
  }
}

export function discardPrimedCameraStream(): void {
  if (!primedStreamPromise) {
    return;
  }

  void primedStreamPromise
    .then((stream) => {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    })
    .catch(() => {
      /* ignore discard errors */
    });
  primedStreamPromise = null;
}

export function isInvitationQrScanSupported(): boolean {
  return window.isSecureContext && navigator.mediaDevices?.getUserMedia != null;
}

export function getInvitationQrScannerErrorMessage(): string {
  if (!window.isSecureContext) {
    return 'Camera access requires a secure connection (HTTPS). Open this page over HTTPS or use localhost.';
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Your browser does not support camera access.';
  }

  return 'Could not access the camera.';
}

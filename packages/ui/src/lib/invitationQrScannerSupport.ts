export type InvitationQrScannerSession = {
  stop: () => Promise<void>;
};

/** Request camera access while a user gesture is still active (mobile browsers). */
export function primeInvitationQrCameraAccess(): void {
  if (!window.isSecureContext) {
    return;
  }

  const getUserMedia = navigator.mediaDevices?.getUserMedia;
  if (!getUserMedia) {
    return;
  }

  void getUserMedia
    .call(navigator.mediaDevices, {
      video: { facingMode: { ideal: 'environment' } },
    })
    .then((stream) => {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    })
    .catch(() => {
      /* scanner dialog surfaces errors */
    });
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

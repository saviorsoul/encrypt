export type ScanInvitationQrCodeResult =
  | { status: 'scanned'; text: string }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

function isScanCancelledMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('cancel') ||
    lower.includes('closed') ||
    lower.includes('dismiss')
  );
}

/** Open the native barcode scanner on Capacitor Android/iOS. */
export async function scanInvitationQrCodeNative(): Promise<ScanInvitationQrCodeResult> {
  const { Capacitor } = await import('@capacitor/core');
  if (!Capacitor.isNativePlatform()) {
    return { status: 'unsupported' };
  }

  try {
    const {
      CapacitorBarcodeScanner,
      CapacitorBarcodeScannerCameraDirection,
      CapacitorBarcodeScannerTypeHint,
    } = await import('@capacitor/barcode-scanner');

    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: 'Scan the invitation QR code',
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    });

    const rawValue = result.ScanResult?.trim();
    if (!rawValue) {
      return { status: 'cancelled' };
    }

    return { status: 'scanned', text: rawValue };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not scan QR code.';
    if (isScanCancelledMessage(message)) {
      return { status: 'cancelled' };
    }
    return { status: 'error', message };
  }
}

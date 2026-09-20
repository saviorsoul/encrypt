import { useEffect } from 'react';
import { subscribeBridgeChannel } from '@lab/crypto/bridgeChannel.ts';
import { initializeBridgePairingStorage } from '@lab/crypto/systemAppPairingStorage.ts';
import {
  handleBridgeChannelMessage,
  handleBridgeStorageEvent,
} from '@lab/crypto/systemAppSigner.ts';

export function useSystemAppBridgeListener(): void {
  useEffect(() => {
    initializeBridgePairingStorage();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      handleBridgeStorageEvent(event);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    return subscribeBridgeChannel(handleBridgeChannelMessage);
  }, []);
}

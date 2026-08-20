import type { PrismaTx } from '@/lib/prisma.js';
import type {
  EcPublicKey,
  RegisterUserInput,
} from '@/contexts/users/domain/types.js';

export type { EcPublicKey, RegisterUserInput };

export interface UserRepository {
  register(input: RegisterUserInput): Promise<void>;
  registerIfAbsent(input: RegisterUserInput): Promise<void>;
  findRegisteredKeyIds(keyIds: string[]): Promise<Set<string>>;
  findStatuses(keyIds: string[]): Promise<Map<string, string>>;
  findPublicKeysByKeyIds(keyIds: string[]): Promise<Map<string, EcPublicKey>>;
  exists(keyId: string): Promise<boolean>;
  markInactive(keyId: string, tx?: PrismaTx): Promise<void>;
}

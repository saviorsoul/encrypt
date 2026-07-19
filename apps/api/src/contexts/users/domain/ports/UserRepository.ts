import type {
  EcPublicKey,
  RegisterUserInput,
} from '@/contexts/users/domain/types.js';

export type { EcPublicKey, RegisterUserInput };

export interface UserRepository {
  register(input: RegisterUserInput): Promise<void>;
  registerIfAbsent(input: RegisterUserInput): Promise<void>;
  listUsers(): Promise<Array<{ keyId: string; publicKey: unknown }>>;
  findRegisteredKeyIds(keyIds: string[]): Promise<Set<string>>;
  findPublicKeysByKeyIds(keyIds: string[]): Promise<Map<string, EcPublicKey>>;
  exists(keyId: string): Promise<boolean>;
}

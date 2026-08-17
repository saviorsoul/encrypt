export type {
  EcPublicKey,
  RegisterUserInput,
  UserRepository,
} from './domain/ports/UserRepository.js';
export { userRepository } from './infrastructure/prismaUserRepository.js';
export { assertUsersRegistered } from './application/services/assertUsersRegistered.js';
export {
  ensureRegisteredAfterFriendship,
  ensureRegisteredAfterFriendshipPair,
} from './application/services/ensureRegisteredAfterFriendship.js';

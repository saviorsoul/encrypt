export type {
  EcPublicKey,
  RegisterUserInput,
  UserRepository,
} from './domain/ports/UserRepository.js';
export {
  USER_STATUS_ACTIVE,
  USER_STATUS_INACTIVE,
  type UserStatus,
} from './domain/constants.js';
export { userRepository } from './infrastructure/prismaUserRepository.js';
export { assertUsersRegistered } from './application/services/assertUsersRegistered.js';
export { assertCurrentUserRegistered } from './application/services/assertCurrentUserRegistered.js';
export { handleClearAccount } from './application/commands/clearAccount/clearAccount.handler.js';
export type { ClearAccountCommand } from './application/commands/clearAccount/clearAccount.handler.js';
export {
  ensureRegisteredAfterFriendship,
  ensureRegisteredAfterFriendshipPair,
} from './application/services/ensureRegisteredAfterFriendship.js';

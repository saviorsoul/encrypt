import { userRepository } from '@/contexts/users/infrastructure/prismaUserRepository.js';

export async function handleListUsers() {
  return userRepository.listUsers();
}

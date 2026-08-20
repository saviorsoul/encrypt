import type { FeedRepository } from '@/contexts/feed/domain/ports/FeedRepository.js';
import { eraseRecipientFeedData } from './eraseRecipientFeedData.js';

export const feedRepository: FeedRepository = {
  eraseRecipientFeedData,
};

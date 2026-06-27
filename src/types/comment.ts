import type { COMMENT_WRAP } from '@/crypto/commentConstants.ts';
import type { ManifestEncryptedContentSignableBody } from '@/types/manifest.ts';

export type CommentSignableBody = {
  version: number;
  wrap: typeof COMMENT_WRAP;
  messageId: string;
  senderPublicJwk: JsonWebKey;
  salt: string;
  encryptedContent: ManifestEncryptedContentSignableBody;
};

export interface CommentPayload extends CommentSignableBody {
  senderSignature: string;
}

export type ParsedCommentImportPayload = CommentPayload;

export type ParseCommentImportPayloadResult =
  | { ok: true; payload: ParsedCommentImportPayload }
  | { ok: false; error: string };

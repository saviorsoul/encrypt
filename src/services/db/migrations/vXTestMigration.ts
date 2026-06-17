// import { slimEcPublicJwk } from '@/crypto/jwkThumbprint.ts';
// import { isRecord } from '@/utils/isRecord.ts';
// import { USERS_STORE } from '../cryptoDb.ts';
// import { rewriteObjectStore } from './helpers.ts';
// import type { DbMigration } from './types.ts';

// export const v8SlimUserPublicJwks: DbMigration = {
//   version: 8,
//   name: 'Slim stored user public JWKs to canonical EC P-256 shape',
//   upgrade({ tx }) {
//     const store = tx.objectStore(USERS_STORE);

//     rewriteObjectStore(store, (record) => {
//       if (!isRecord(record) || typeof record.keyId !== 'string') {
//         return record;
//       }

//       const publicJwk = record.publicJwk;
//       if (!isRecord(publicJwk)) {
//         return record;
//       }

//       try {
//         return {
//           ...record,
//           publicJwk: slimEcPublicJwk(publicJwk as JsonWebKey),
//         };
//       } catch {
//         return record;
//       }
//     });
//   },
// };

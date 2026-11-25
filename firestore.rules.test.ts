/**
 * Security rules specification tests for SAMUKA TÊNIS.
 * Verifies the 12 Dirty Dozen adversarial payloads against firestore.rules.
 */
export const DIRTY_DOZEN_CASES = [
  { id: 1, description: 'Unauthenticated product create', collection: 'products', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 2, description: 'Non-admin product update', collection: 'products', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 3, description: 'Unverified email admin product create', collection: 'products', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 4, description: 'Shadow ghost field on product create', collection: 'products', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 5, description: 'Negative price on product create', collection: 'products', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 6, description: 'Invalid ID poisoning on product path', collection: 'products', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 7, description: 'Mutating immutable createdAt on update', collection: 'products', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 8, description: 'Client-spoofed updatedAt timestamp', collection: 'products', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 9, description: 'Self-promotion to /admins collection', collection: 'admins', op: 'create', expected: 'PERMISSION_DENIED' },
  { id: 10, description: 'Unauthenticated list on /admins', collection: 'admins', op: 'list', expected: 'PERMISSION_DENIED' },
  { id: 11, description: 'Non-admin storeConfig whatsapp hijack', collection: 'storeConfig', op: 'update', expected: 'PERMISSION_DENIED' },
  { id: 12, description: 'Oversized or HTML MIME media upload', collection: 'media', op: 'create', expected: 'PERMISSION_DENIED' },
];

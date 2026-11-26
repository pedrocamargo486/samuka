# Security Specification — SAMUKA TÊNIS

## 1. Data Invariants
1. Only verified administrators (`email_verified == true` and either primary owner `pedrocamargo486@gmail.com` or an existing UID in `/admins/{uid}`) may create, update, or delete `/products`, `/brands`, `/storeConfig`, `/media`, or `/admins`.
2. Every document ID (`productId`, `brandId`, `configId`, `mediaId`, `adminUid`) must match `^[a-zA-Z0-9_-]+$` and be <= 128 characters.
3. Public storefront reads on `/products` and `/brands` only return active records (unless requested by an admin).
4. All writes enforce strict field allowlists (`keys().hasAll(...)` and `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` + full schema validation on update).
5. `createdAt` is immutable and strictly equal to `request.time` at creation; `updatedAt` must equal `request.time` on both create and update.
6. No unauthenticated or non-admin user can escalate privileges by creating a document in `/admins`.

## 2. Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated create on `/products/p1` -> DENIED.
2. Signed-in non-admin user update on `/products/p1` -> DENIED.
3. Signed-in admin with `email_verified: false` creating `/products/p1` -> DENIED.
4. Admin create on `/products/p1` with extra ghost field `isVerified: true` -> DENIED.
5. Admin create on `/products/p1` with invalid negative price (`price: -10`) -> DENIED.
6. Admin create on `/products/bad$id` with invalid path characters -> DENIED.
7. Admin update on `/products/p1` mutating `createdAt` -> DENIED.
8. Admin update on `/products/p1` with `updatedAt` set to a spoofed past client timestamp -> DENIED.
9. Non-admin user attempting to self-promote in `/admins/{uid}` -> DENIED.
10. Unauthenticated user listing `/admins` -> DENIED.
11. Signed-in non-admin modifying `/storeConfig/main` (`whatsappNumber`) -> DENIED.
12. Admin creating `/media/m1` with `base64Data` > 350KB or invalid MIME type (`text/html`) -> DENIED.
13. Unauthenticated or non-admin reading/listing/updating/deleting `/orders` containing customer PII -> DENIED.
14. Customer creating `/orders/o1` directly with `status: 'confirmado'` -> DENIED.


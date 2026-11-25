import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  PRIMARY_OWNER_EMAIL,
  storage,
} from './firebase';
import { DEFAULT_STORE_CONFIG, INITIAL_BRANDS, STARTER_SHOWCASE_PRODUCTS } from './seedData';
import { compressImageToBase64, sanitizeImageUrl, slugify } from './utils';
import type { AdminUserRecord, Brand, Product, StoreConfig } from '../types';

export interface SneakerWebLookupResponse {
  name: string;
  brandName: string;
  description: string;
  details: string;
  gender: Product['gender'];
  type: Product['type'];
  occasion: string;
  colors: string[];
  suggestedPrice: number;
  imageUrls: string[];
  sources: { title: string; uri: string }[];
}

export async function checkIsUserAdmin(uid: string, email: string | null): Promise<boolean> {
  if (!uid) return false;
  if (email && email === PRIMARY_OWNER_EMAIL && auth.currentUser?.emailVerified) {
    return true;
  }
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists() && snap.data()?.role === 'admin';
  } catch (error) {
    console.warn('Admin check denied for non-admin:', path, error);
    return false;
  }
}

export async function fetchStoreConfig(): Promise<StoreConfig> {
  const path = 'storeConfig/main';
  try {
    const snap = await getDoc(doc(db, 'storeConfig', 'main'));
    if (!snap.exists()) {
      return DEFAULT_STORE_CONFIG;
    }
    const data = snap.data() as Partial<StoreConfig>;
    return {
      ...DEFAULT_STORE_CONFIG,
      ...data,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveStoreConfig(config: StoreConfig): Promise<void> {
  const path = 'storeConfig/main';
  try {
    const payload = {
      storeName: (config.storeName || 'SAMUKA TÊNIS').trim().slice(0, 80),
      heroTitle: (config.heroTitle || DEFAULT_STORE_CONFIG.heroTitle).trim().slice(0, 140),
      heroSubtitle: (config.heroSubtitle || '').trim().slice(0, 240),
      heroCtaText: (config.heroCtaText || 'EXPLORAR COLEÇÃO').trim().slice(0, 50),
      heroImageUrl: sanitizeImageUrl(config.heroImageUrl).slice(0, 500),
      whatsappNumber: (config.whatsappNumber || '').replace(/\D/g, '').slice(0, 20),
      storeAddress: (config.storeAddress || '').trim().slice(0, 300),
      openingHours: (config.openingHours || '').trim().slice(0, 200),
      pickupInfo: (config.pickupInfo || '').trim().slice(0, 400),
      pickupFree: Boolean(config.pickupFree),
      shippingMode: config.shippingMode || 'confirm_store',
      fixedShippingPrice: Math.max(0, Math.min(10000, Number(config.fixedShippingPrice) || 0)),
      fixedShippingDays: (config.fixedShippingDays || '').trim().slice(0, 60),
      shippingApiEndpoint: (config.shippingApiEndpoint || '').trim().slice(0, 300),
      instagramUrl: (config.instagramUrl || '').trim().slice(0, 200),
      updatedAt: serverTimestamp(),
    };

    const existingSnap = await getDoc(doc(db, 'storeConfig', 'main'));
    if (existingSnap.exists()) {
      await updateDoc(doc(db, 'storeConfig', 'main'), payload);
    } else {
      await setDoc(doc(db, 'storeConfig', 'main'), payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchBrands(includeInactive = false): Promise<Brand[]> {
  const path = 'brands';
  try {
    const q = includeInactive
      ? query(collection(db, 'brands'), orderBy('order', 'asc'))
      : query(collection(db, 'brands'), where('active', '==', true));
    const snap = await getDocs(q);

    if (snap.empty) {
      // Auto-provision pre-configured brands when an authenticated admin opens the panel
      if (includeInactive && auth.currentUser) {
        await seedInitialBrandsToFirestore();
      }
      return INITIAL_BRANDS;
    }

    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Brand, 'id'>),
    }));
    return list.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveBrand(
  brand: Omit<Brand, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const cleanId = (brand.id || slugify(brand.name)).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  const path = `brands/${cleanId}`;
  try {
    const baseData = {
      name: brand.name.trim().slice(0, 64),
      slug: (slugify(brand.slug || brand.name) || cleanId).slice(0, 64),
      logoUrl: sanitizeImageUrl(brand.logoUrl || '').slice(0, 500),
      order: Math.max(0, Math.min(9999, Number(brand.order) || 0)),
      active: Boolean(brand.active),
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      await setDoc(doc(db, 'brands', cleanId), {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'brands', cleanId), baseData);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteBrand(brandId: string): Promise<void> {
  const path = `brands/${brandId}`;
  try {
    await deleteDoc(doc(db, 'brands', brandId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedInitialBrandsToFirestore(): Promise<void> {
  const path = 'brands';
  try {
    const batch = writeBatch(db);
    INITIAL_BRANDS.forEach((b) => {
      batch.set(doc(db, 'brands', b.id), {
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl,
        order: b.order,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchProducts(includeInactive = false): Promise<{
  products: Product[];
  isFromFirestore: boolean;
}> {
  const path = 'products';
  try {
    const q = includeInactive
      ? query(collection(db, 'products'))
      : query(collection(db, 'products'), where('active', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) {
      return {
        products: includeInactive ? [] : STARTER_SHOWCASE_PRODUCTS,
        isFromFirestore: false,
      };
    }
    const products = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Product, 'id'>),
    }));
    return { products, isFromFirestore: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveProduct(
  product: Omit<Product, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<string> {
  const cleanId = (
    product.id || `${slugify(product.name).slice(0, 40)}-${Date.now().toString(36)}`
  )
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 120);
  const path = `products/${cleanId}`;

  try {
    const sanitizedSizes: Record<string, number> = {};
    Object.entries(product.sizes || {}).forEach(([sizeKey, qty]) => {
      const cleanSize = sizeKey.trim().slice(0, 12);
      if (cleanSize) {
        sanitizedSizes[cleanSize] = Math.max(0, Math.floor(Number(qty) || 0));
      }
    });

    const sanitizedColors = (product.colors || [])
      .map((c) => c.trim().slice(0, 32))
      .filter(Boolean)
      .slice(0, 12);

    const sanitizedImages = (product.images || [])
      .map((img) => sanitizeImageUrl(img))
      .filter(Boolean)
      .slice(0, 8);

    const payload = {
      name: product.name.trim().slice(0, 120),
      slug: (slugify(product.slug || product.name) || cleanId).slice(0, 140),
      brandId: product.brandId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64),
      brandName: product.brandName.trim().slice(0, 64),
      description: (product.description || '').trim().slice(0, 2000),
      details: (product.details || '').trim().slice(0, 1000),
      price: Math.max(0, Math.min(100000, Number(product.price) || 0)),
      promoPrice: Math.max(0, Math.min(100000, Number(product.promoPrice) || 0)),
      isPromo: Boolean(product.isPromo),
      isFeatured: Boolean(product.isFeatured),
      isNewRelease: Boolean(product.isNewRelease),
      outOfStock: Boolean(product.outOfStock),
      active: Boolean(product.active),
      gender: product.gender || 'unissex',
      type: product.type || 'casual',
      occasion: (product.occasion || '').trim().slice(0, 80),
      colors: sanitizedColors,
      images: sanitizedImages,
      sizes: sanitizedSizes,
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      await setDoc(doc(db, 'products', cleanId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'products', cleanId), payload);
    }

    return cleanId;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedStarterShowcaseToFirestore(): Promise<void> {
  const path = 'products';
  try {
    const batch = writeBatch(db);
    STARTER_SHOWCASE_PRODUCTS.forEach((p) => {
      batch.set(doc(db, 'products', p.id), {
        name: p.name,
        slug: p.slug,
        brandId: p.brandId,
        brandName: p.brandName,
        description: p.description,
        details: p.details,
        price: p.price,
        promoPrice: p.promoPrice,
        isPromo: p.isPromo,
        isFeatured: p.isFeatured,
        isNewRelease: p.isNewRelease,
        outOfStock: p.outOfStock,
        active: p.active,
        gender: p.gender,
        type: p.type,
        occasion: p.occasion,
        colors: p.colors,
        images: p.images,
        sizes: p.sizes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function uploadProductOrBrandImage(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Faça login como administrador para enviar imagens.');
  }

  const safeExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  try {
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch {
    const { mimeType, base64Data } = await compressImageToBase64(file);
    const mediaId = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const path = `media/${mediaId}`;
    try {
      await setDoc(doc(db, 'media', mediaId), {
        mimeType,
        base64Data,
        uploadedBy: uid,
        createdAt: serverTimestamp(),
      });
      return `firestore-media://${mediaId}`;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function searchSneakerOnWeb(queryText: string): Promise<SneakerWebLookupResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login como administrador para pesquisar modelos.');
  }
  const token = await user.getIdToken();
  const res = await fetch('/api/sneaker-lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query: queryText }),
  });

  const payload = (await res.json()) as SneakerWebLookupResponse & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || 'Erro ao pesquisar tênis na web.');
  }
  return payload;
}

export async function importRemoteImageToStore(imageUrl: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login como administrador para importar imagens.');
  }
  const token = await user.getIdToken();
  const res = await fetch('/api/fetch-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: imageUrl }),
  });

  const payload = (await res.json()) as {
    mimeType?: string;
    base64Data?: string;
    error?: string;
  };
  if (!res.ok || !payload.base64Data || !payload.mimeType) {
    // If remote download fails, still allow direct verified HTTPS URL as fallback
    return imageUrl;
  }

  // Convert downloaded bytes to File and run through standard upload/compression pipeline
  const byteChars = atob(payload.base64Data);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const ext = payload.mimeType.split('/')[1] || 'jpg';
  const file = new File([byteNumbers], `imported.${ext}`, { type: payload.mimeType });
  return uploadProductOrBrandImage(file);
}

export async function fetchAdmins(): Promise<AdminUserRecord[]> {
  const path = 'admins';
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AdminUserRecord, 'id'>),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addAdminUser(uid: string, email: string): Promise<void> {
  const cleanUid = uid.trim();
  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      email: email.trim().slice(0, 120),
      role: 'admin',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAdminUser(uid: string): Promise<void> {
  const path = `admins/${uid}`;
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

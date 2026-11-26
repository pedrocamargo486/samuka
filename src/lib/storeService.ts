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
import {
  compressImageToBase64,
  getLocalISODate,
  sanitizeImageUrl,
  sanitizeVideoUrl,
  slugify,
} from './utils';
import type {
  AdminUserRecord,
  Brand,
  CartItem,
  OrderItem,
  OrderRecord,
  Product,
  SaleRecord,
  StoreConfig,
} from '../types';

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
  videoUrls?: string[];
  videos?: { title: string; url: string }[];
  sources: { title: string; uri: string }[];
  sourceMode?: 'live_catalog' | 'gemini_search';
  warning?: string;
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

let brandSeedInFlight: Promise<void> | null = null;

export async function seedInitialBrandsToFirestore(updateExisting = false): Promise<void> {
  if (brandSeedInFlight) {
    return brandSeedInFlight;
  }
  const path = 'brands';
  brandSeedInFlight = (async () => {
    try {
      const existingSnap = await getDocs(collection(db, 'brands'));
      const existingById = new Map(existingSnap.docs.map((d) => [d.id, d.data()]));
      const batch = writeBatch(db);
      let pendingOps = 0;

      INITIAL_BRANDS.forEach((b) => {
        const refDoc = doc(db, 'brands', b.id);
        const existingData = existingById.get(b.id);
        if (!existingData) {
          batch.set(refDoc, {
            name: b.name,
            slug: b.slug,
            logoUrl: b.logoUrl,
            order: b.order,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          pendingOps++;
        } else if (updateExisting && existingData.createdAt) {
          batch.update(refDoc, {
            name: b.name,
            slug: b.slug,
            logoUrl: typeof existingData.logoUrl === 'string' ? existingData.logoUrl : b.logoUrl,
            order: b.order,
            active: true,
            updatedAt: serverTimestamp(),
          });
          pendingOps++;
        }
      });

      if (pendingOps > 0) {
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      brandSeedInFlight = null;
    }
  })();

  return brandSeedInFlight;
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
      .slice(0, 15);

    const sanitizedVideos = (product.videos || [])
      .map((vid) => sanitizeVideoUrl(vid))
      .filter(Boolean)
      .slice(0, 4);

    const payload = {
      name: product.name.trim().slice(0, 120),
      slug: (slugify(product.slug || product.name) || cleanId).slice(0, 140),
      brandId: product.brandId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64),
      brandName: product.brandName.trim().slice(0, 64),
      description: (product.description || '').trim().slice(0, 2000),
      details: (product.details || '').trim().slice(0, 1000),
      price: Math.max(0, Math.min(100000, Number(product.price) || 0)),
      promoPrice: Math.max(0, Math.min(100000, Number(product.promoPrice) || 0)),
      costPrice: Math.max(0, Math.min(100000, Number(product.costPrice) || 0)),
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
      videos: sanitizedVideos,
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

export async function updateProductStock(
  productId: string,
  sizes: Record<string, number>,
  outOfStock?: boolean
): Promise<void> {
  const path = `products/${productId}`;
  try {
    const sanitizedSizes: Record<string, number> = {};
    Object.entries(sizes || {}).forEach(([sizeKey, qty]) => {
      const cleanSize = sizeKey.trim().slice(0, 12);
      if (cleanSize) {
        sanitizedSizes[cleanSize] = Math.max(0, Math.floor(Number(qty) || 0));
      }
    });
    const totalPairs = Object.values(sanitizedSizes).reduce((acc, n) => acc + n, 0);
    await updateDoc(doc(db, 'products', productId), {
      sizes: sanitizedSizes,
      outOfStock: typeof outOfStock === 'boolean' ? outOfStock : totalPairs === 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
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

export async function seedStarterShowcaseToFirestore(): Promise<{
  added: number;
  total: number;
}> {
  const path = 'products';
  try {
    const existingSnap = await getDocs(collection(db, 'products'));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const batch = writeBatch(db);
    let pendingOps = 0;

    STARTER_SHOWCASE_PRODUCTS.forEach((p) => {
      if (existingIds.has(p.id)) return;
      batch.set(doc(db, 'products', p.id), {
        name: p.name,
        slug: p.slug,
        brandId: p.brandId,
        brandName: p.brandName,
        description: p.description,
        details: p.details,
        price: p.price,
        promoPrice: p.promoPrice,
        costPrice: p.costPrice ?? 0,
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
      pendingOps++;
    });

    if (pendingOps > 0) {
      await batch.commit();
    }
    return { added: pendingOps, total: STARTER_SHOWCASE_PRODUCTS.length };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function clearDemoShowcaseFromFirestore(): Promise<number> {
  const path = 'products';
  try {
    const existingSnap = await getDocs(collection(db, 'products'));
    const batch = writeBatch(db);
    let deletedCount = 0;

    existingSnap.docs.forEach((d) => {
      if (d.id.startsWith('demo-')) {
        batch.delete(doc(db, 'products', d.id));
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
    }
    return deletedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

let storageUnavailableInSession = false;

export async function uploadProductOrBrandImage(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Faça login como administrador para enviar imagens.');
  }

  const safeExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const fileName = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  if (!storageUnavailableInSession) {
    try {
      const storageRef = ref(storage, fileName);
      await Promise.race([
        uploadBytes(storageRef, file),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Storage timeout')), 4000)
        ),
      ]);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch {
      storageUnavailableInSession = true;
    }
  }

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

  const rawText = await res.text();
  let payload: (SneakerWebLookupResponse & { error?: string }) | null = null;
  try {
    payload = JSON.parse(rawText) as SneakerWebLookupResponse & { error?: string };
  } catch {
    throw new Error(
      `O servidor retornou uma resposta inesperada (HTTP ${res.status}). Verifique os logs da função ou a chave GEMINI_API_KEY nas variáveis de ambiente.`
    );
  }

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
  try {
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const res = await fetch('/api/fetch-image', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url: imageUrl }),
    });
    clearTimeout(timeout);

    const rawText = await res.text();
    let payload: {
      mimeType?: string;
      base64Data?: string;
      error?: string;
    } = {};
    try {
      payload = JSON.parse(rawText) as {
        mimeType?: string;
        base64Data?: string;
        error?: string;
      };
    } catch {
      return imageUrl;
    }
    if (!res.ok || !payload.base64Data || !payload.mimeType) {
      return imageUrl;
    }

    const byteChars = atob(payload.base64Data);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const ext = payload.mimeType.split('/')[1] || 'jpg';
    const file = new File([byteNumbers], `imported.${ext}`, { type: payload.mimeType });
    return await uploadProductOrBrandImage(file);
  } catch {
    return imageUrl;
  }
}

export async function uploadProductVideo(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Faça login como administrador para enviar vídeos.');
  }
  const maxBytes = 45 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('O vídeo excede 45 MB. Comprima o arquivo ou cole um link do YouTube/MP4.');
  }

  const safeExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'mp4';
  const fileName = `uploads/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  try {
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch {
    throw new Error(
      'Não foi possível enviar o arquivo de vídeo para o Storage. Cole o link direto do vídeo (YouTube ou MP4).'
    );
  }
}

export async function fetchSales(): Promise<SaleRecord[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const path = 'sales';
  try {
    const isOwner = user.email === PRIMARY_OWNER_EMAIL && user.emailVerified;
    const q = isOwner
      ? query(collection(db, 'sales'))
      : query(collection(db, 'sales'), where('recordedBy', '==', user.uid));
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SaleRecord, 'id'>),
    }));
    return list.sort((a, b) => {
      if (a.soldDate !== b.soldDate) return b.soldDate.localeCompare(a.soldDate);
      return b.id.localeCompare(a.id);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function recordSale(
  sale: Omit<SaleRecord, 'id' | 'recordedBy' | 'createdAt'>
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Faça login como administrador para registrar vendas.');
  }
  const saleId = `sale-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `sales/${saleId}`;

  const quantity = Math.max(1, Math.min(999, Math.floor(Number(sale.quantity) || 1)));
  const salePrice = Math.max(0, Math.min(100000, Number(sale.salePrice) || 0));
  const costPrice = Math.max(0, Math.min(100000, Number(sale.costPrice) || 0));
  const extraFee = Math.max(0, Math.min(100000, Number(sale.extraFee) || 0));
  const profit = Number(((salePrice - costPrice) * quantity - extraFee).toFixed(2));
  const validDate = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(sale.soldDate)
    ? sale.soldDate
    : new Date().toISOString().slice(0, 10);

  try {
    await setDoc(doc(db, 'sales', saleId), {
      productId: (sale.productId || '').trim().slice(0, 120),
      productName: sale.productName.trim().slice(0, 140),
      brandName: (sale.brandName || '').trim().slice(0, 64),
      size: (sale.size || '').trim().slice(0, 12),
      quantity,
      salePrice,
      costPrice,
      extraFee,
      profit,
      paymentMethod: (sale.paymentMethod || 'Pix').trim().slice(0, 40),
      notes: (sale.notes || '').trim().slice(0, 200),
      soldDate: validDate,
      recordedBy: uid,
      createdAt: serverTimestamp(),
    });
    return saleId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSale(saleId: string): Promise<void> {
  const path = `sales/${saleId}`;
  try {
    await deleteDoc(doc(db, 'sales', saleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
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

export async function createCustomerOrder(params: {
  customerName: string;
  customerPhone: string;
  deliveryMethod: 'delivery' | 'pickup';
  customerCep: string;
  customerAddress: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  items: CartItem[];
  notes?: string;
}): Promise<{ id: string; orderNumber: string }> {
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');
  const timeCode = Date.now().toString(36).slice(-2).toUpperCase();
  const orderNumber = `SAM-${timeCode}${randomSuffix}`.slice(0, 24);
  const orderId = `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `orders/${orderId}`;

  const cleanPhone = (params.customerPhone || '').trim();
  const safePhone = cleanPhone.length >= 4 ? cleanPhone.slice(0, 32) : '0000';

  const sanitizedItems: OrderItem[] = params.items.slice(0, 20).map((item) => ({
    productId: (item.productId || '').trim().slice(0, 120),
    productName: (item.name || 'Tênis').trim().slice(0, 140) || 'Tênis',
    brandName: (item.brandName || '').trim().slice(0, 64),
    size: (item.size || '').trim().slice(0, 12),
    color: (item.color || '').trim().slice(0, 40),
    quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
    unitPrice: Math.max(0, Math.min(100000, Number(item.unitPrice) || 0)),
    image: sanitizeImageUrl(item.image || '').slice(0, 500),
  }));

  if (sanitizedItems.length === 0) {
    throw new Error('O pedido precisa conter pelo menos um item.');
  }

  const subtotal = Math.max(0, Math.min(500000, Number(params.subtotal) || 0));
  const shippingCost = Math.max(0, Math.min(10000, Number(params.shippingCost) || 0));
  const total = Math.max(0, Math.min(500000, Number(params.total) || subtotal + shippingCost));

  const payload = {
    orderNumber,
    customerName: (params.customerName || 'Cliente').trim().slice(0, 120) || 'Cliente',
    customerPhone: safePhone,
    deliveryMethod: params.deliveryMethod === 'pickup' ? ('pickup' as const) : ('delivery' as const),
    customerCep: (params.customerCep || '').trim().slice(0, 12),
    customerAddress: (params.customerAddress || '').trim().slice(0, 300),
    subtotal,
    shippingCost,
    total,
    items: sanitizedItems,
    status: 'pendente' as const,
    paymentMethod: '',
    notes: (params.notes || '').trim().slice(0, 240),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'orders', orderId), payload);
    return { id: orderId, orderNumber };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchOrders(): Promise<OrderRecord[]> {
  const user = auth.currentUser;
  if (!user || user.email !== PRIMARY_OWNER_EMAIL || !user.emailVerified) {
    return [];
  }
  const path = 'orders';
  try {
    const snap = await getDocs(collection(db, 'orders'));
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<OrderRecord, 'id'>),
    }));
    return list.sort((a, b) => {
      const aTime =
        typeof (a.createdAt as { seconds?: number } | undefined)?.seconds === 'number'
          ? (a.createdAt as { seconds: number }).seconds
          : 0;
      const bTime =
        typeof (b.createdAt as { seconds?: number } | undefined)?.seconds === 'number'
          ? (b.createdAt as { seconds: number }).seconds
          : 0;
      if (aTime !== bTime) return bTime - aTime;
      return b.id.localeCompare(a.id);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function confirmOrderAndDeductStock(params: {
  order: OrderRecord;
  products: Product[];
  paymentMethod: string;
  extraFee?: number;
  extraNotes?: string;
}): Promise<{ deductedItems: number; salesRecorded: number }> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Faça login como administrador para confirmar pedidos.');
  }
  if (params.order.status === 'confirmado') {
    throw new Error('Este pedido já foi confirmado anteriormente.');
  }

  const { order, products, paymentMethod, extraFee = 0, extraNotes = '' } = params;
  const cleanPayment = (paymentMethod || 'Pix').trim().slice(0, 40) || 'Pix';
  const todayIso = getLocalISODate(new Date());

  // 1. Aggregate deductions by productId -> size
  const deductionsByProduct = new Map<string, Map<string, number>>();
  for (const item of order.items) {
    if (!item.productId || !item.size) continue;
    let sizeMap = deductionsByProduct.get(item.productId);
    if (!sizeMap) {
      sizeMap = new Map<string, number>();
      deductionsByProduct.set(item.productId, sizeMap);
    }
    const prevQty = sizeMap.get(item.size) || 0;
    sizeMap.set(item.size, prevQty + Math.max(1, Number(item.quantity) || 1));
  }

  // 2. Fetch fresh product documents and decrement stock per size
  const productCache = new Map<string, Product>();
  let deductedItems = 0;

  for (const [productId, sizeDeductions] of deductionsByProduct.entries()) {
    const localMatch = products.find((p) => p.id === productId);
    if (localMatch) {
      productCache.set(productId, localMatch);
    }

    try {
      const snap = await getDoc(doc(db, 'products', productId));
      if (!snap.exists()) continue;

      const freshData = snap.data() as Omit<Product, 'id'>;
      const freshProduct: Product = { id: snap.id, ...freshData };
      productCache.set(productId, freshProduct);

      const nextSizes: Record<string, number> = { ...(freshProduct.sizes || {}) };
      for (const [sizeKey, deductQty] of sizeDeductions.entries()) {
        if (Object.prototype.hasOwnProperty.call(nextSizes, sizeKey)) {
          nextSizes[sizeKey] = Math.max(0, (Number(nextSizes[sizeKey]) || 0) - deductQty);
          deductedItems += deductQty;
        }
      }

      await updateProductStock(productId, nextSizes);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
    }
  }

  // 3. Record sales for the Profit Calculator (extraFee applied once on the first item)
  let salesRecorded = 0;
  for (let idx = 0; idx < order.items.length; idx++) {
    const item = order.items[idx];
    const prod = productCache.get(item.productId) || products.find((p) => p.id === item.productId);
    const qty = Math.max(1, Number(item.quantity) || 1);
    const salePrice = Math.max(0, Number(item.unitPrice) || 0);
    const costPrice = Math.max(0, Number(prod?.costPrice) || 0);
    const itemFee = idx === 0 ? Math.max(0, Number(extraFee) || 0) : 0;
    const profit = Number(((salePrice - costPrice) * qty - itemFee).toFixed(2));
    const noteSummary = [
      `Pedido #${order.orderNumber}`,
      order.customerName,
      item.color ? `Cor: ${item.color}` : '',
      extraNotes.trim(),
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 200);

    await recordSale({
      productId: item.productId,
      productName: item.productName,
      brandName: item.brandName || prod?.brandName || '',
      size: item.size,
      quantity: qty,
      salePrice,
      costPrice,
      extraFee: itemFee,
      profit,
      paymentMethod: cleanPayment,
      notes: noteSummary,
      soldDate: todayIso,
    });
    salesRecorded += 1;
  }

  // 4. Mark order confirmed
  const finalNotes = (extraNotes.trim() || order.notes || '').slice(0, 240);
  try {
    await updateDoc(doc(db, 'orders', order.id), {
      status: 'confirmado',
      paymentMethod: cleanPayment,
      notes: finalNotes,
      confirmedBy: uid.slice(0, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${order.id}`);
  }

  return { deductedItems, salesRecorded };
}

export async function cancelOrder(orderId: string, notes?: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'cancelado',
      notes: (notes ?? '').trim().slice(0, 240),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}


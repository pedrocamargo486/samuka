export type GenderOption = 'masculino' | 'feminino' | 'infantil' | 'unissex';

export type SneakerType =
  | 'corrida'
  | 'academia'
  | 'casual'
  | 'dia_a_dia'
  | 'trabalho'
  | 'ocasioes_especiais';

export type ShippingMode = 'confirm_store' | 'fixed_rate' | 'external_api';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  order: number;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brandId: string;
  brandName: string;
  description: string;
  details: string;
  price: number;
  promoPrice: number;
  costPrice?: number;
  isPromo: boolean;
  isFeatured: boolean;
  isNewRelease: boolean;
  outOfStock: boolean;
  active: boolean;
  gender: GenderOption;
  type: SneakerType;
  occasion: string;
  colors: string[];
  images: string[];
  videos?: string[];
  sizes: Record<string, number>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SaleRecord {
  id: string;
  productId: string;
  productName: string;
  brandName: string;
  size: string;
  quantity: number;
  salePrice: number;
  costPrice: number;
  extraFee: number;
  profit: number;
  paymentMethod: string;
  notes: string;
  soldDate: string;
  recordedBy: string;
  createdAt?: unknown;
}

export interface StoreConfig {
  storeName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaText: string;
  heroImageUrl: string;
  whatsappNumber: string;
  storeAddress: string;
  openingHours: string;
  pickupInfo: string;
  pickupFree: boolean;
  shippingMode: ShippingMode;
  fixedShippingPrice: number;
  fixedShippingDays: string;
  shippingApiEndpoint: string;
  instagramUrl: string;
  updatedAt?: unknown;
}

export interface CartItem {
  key: string;
  productId: string;
  name: string;
  brandName: string;
  image: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
}

export interface ProductFilters {
  search: string;
  brandId: string;
  gender: GenderOption | 'todos';
  type: SneakerType | 'todos';
  size: string;
  color: string;
  occasion: string;
  minPrice: string;
  maxPrice: string;
  onlyPromo: boolean;
  onlyInStock: boolean;
  vitrine: 'todos' | 'mais_vendidos' | 'lancamentos' | 'ofertas';
}

export interface CustomerOrderInfo {
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface ShippingQuote {
  status: 'idle' | 'loading' | 'calculated' | 'confirm_store' | 'error';
  price: number | null;
  estimatedDays: string;
  modality: string;
  message: string;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  role: 'admin';
  createdAt?: unknown;
}

export type OrderStatus = 'pendente' | 'confirmado' | 'cancelado';

export interface OrderItem {
  productId: string;
  productName: string;
  brandName: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  image: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: 'delivery' | 'pickup';
  customerCep: string;
  customerAddress: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  items: OrderItem[];
  status: OrderStatus;
  paymentMethod: string;
  notes: string;
  confirmedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}


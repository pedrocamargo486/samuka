import { useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Boxes,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Film,
  Globe,
  Image as ImageIcon,
  Loader2,
  LogOut,
  Minus,
  Package,
  Pencil,
  Play,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  ALL_STANDARD_SIZES,
  GENDER_LABELS,
  KIDS_SIZES,
  SNEAKER_TYPE_LABELS,
  STUDIO_IMAGE_PRESETS,
} from '../lib/seedData';
import { auth, googleProvider, PRIMARY_OWNER_EMAIL } from '../lib/firebase';
import {
  addAdminUser,
  deleteBrand,
  deleteProduct,
  fetchAdmins,
  fetchBrands,
  fetchOrders,
  fetchProducts,
  fetchSales,
  importRemoteImageToStore,
  removeAdminUser,
  saveBrand,
  saveProduct,
  saveStoreConfig,
  searchSneakerOnWeb,
  seedInitialBrandsToFirestore,
  seedStarterShowcaseToFirestore,
  updateProductStock,
  uploadProductOrBrandImage,
  uploadProductVideo,
  type SneakerWebLookupResponse,
} from '../lib/storeService';
import { formatBRL, parseVideoSource, sanitizeVideoUrl, slugify } from '../lib/utils';
import type {
  AdminUserRecord,
  Brand,
  GenderOption,
  OrderRecord,
  Product,
  SaleRecord,
  ShippingMode,
  SneakerType,
  StoreConfig,
} from '../types';
import { BrandLogo } from './BrandLogo';
import { OrdersTab } from './OrdersTab';
import { ProfitCalculatorTab } from './ProfitCalculatorTab';
import { SmartImage } from './SmartImage';

interface AdminDashboardProps {
  user: User | null;
  isAdmin: boolean;
  authLoading: boolean;
  storeConfig: StoreConfig;
  onRefreshStorefront: () => Promise<void>;
  onBackToStore: () => void;
}

type AdminTab =
  | 'produtos'
  | 'pedidos'
  | 'lucros'
  | 'marcas'
  | 'pagina_inicial'
  | 'configuracoes'
  | 'equipe';

const EMPTY_PRODUCT_FORM: Omit<Product, 'createdAt' | 'updatedAt'> = {
  id: '',
  name: '',
  slug: '',
  brandId: 'nike',
  brandName: 'Nike',
  description: '',
  details: '',
  price: 0,
  promoPrice: 0,
  costPrice: 0,
  isPromo: false,
  isFeatured: false,
  isNewRelease: false,
  outOfStock: false,
  active: true,
  gender: 'unissex',
  type: 'casual',
  occasion: '',
  colors: [],
  images: [],
  videos: [],
  sizes: {
    '34': 0,
    '35': 0,
    '36': 0,
    '37': 0,
    '38': 2,
    '39': 2,
    '40': 2,
    '41': 2,
    '42': 1,
    '43': 0,
    '44': 0,
  },
};

export function AdminDashboard({
  user,
  isAdmin,
  authLoading,
  storeConfig,
  onRefreshStorefront,
  onBackToStore,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('produtos');
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [configDraft, setConfigDraft] = useState<StoreConfig>(storeConfig);

  const [loadingData, setLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Product Form State
  const [editingProduct, setEditingProduct] = useState<Omit<Product, 'createdAt' | 'updatedAt'> | null>(
    null
  );
  const [isNewProduct, setIsNewProduct] = useState(true);
  const [newColorInput, setNewColorInput] = useState('');
  const [newImageUrlInput, setNewImageUrlInput] = useState('');
  const [newVideoUrlInput, setNewVideoUrlInput] = useState('');
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [bulkStockValue, setBulkStockValue] = useState(2);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Quick Stock Modal State
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockDraftSizes, setStockDraftSizes] = useState<Record<string, number>>({});
  const [stockModalCustomSize, setStockModalCustomSize] = useState('');
  const [stockModalBulkQty, setStockModalBulkQty] = useState(2);
  const [savingStockModal, setSavingStockModal] = useState(false);

  // Smart Web Sneaker Lookup State
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [webSearching, setWebSearching] = useState(false);
  const [webLookupResult, setWebLookupResult] = useState<SneakerWebLookupResponse | null>(null);
  const [importingImageUrl, setImportingImageUrl] = useState<string | null>(null);
  const [importedUrlMap, setImportedUrlMap] = useState<Record<string, string>>({});
  const [autoImportingPhotos, setAutoImportingPhotos] = useState(false);

  // Brand Form State
  const [editingBrand, setEditingBrand] = useState<Omit<Brand, 'createdAt' | 'updatedAt'> | null>(
    null
  );
  const [isNewBrand, setIsNewBrand] = useState(true);

  // Admin Team Form
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');

  useEffect(() => {
    setConfigDraft(storeConfig);
  }, [storeConfig]);

  const loadAdminCollections = async () => {
    setLoadingData(true);
    setErrorMessage('');
    try {
      const [prodRes, brandList, salesList, ordersList] = await Promise.all([
        fetchProducts(true),
        fetchBrands(true),
        fetchSales(),
        fetchOrders(),
      ]);
      setProducts(prodRes.products);
      setBrands(brandList);
      setSales(salesList);
      setOrders(ordersList);

      if (user?.email === PRIMARY_OWNER_EMAIL) {
        const adminList = await fetchAdmins();
        setAdmins(adminList);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao carregar dados do painel.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      void loadAdminCollections();
    }
  }, [user, isAdmin]);

  const notify = (msg: string) => {
    setStatusMessage(msg);
    setErrorMessage('');
    setTimeout(() => setStatusMessage(''), 4000);
  };

  const handleLogin = async () => {
    setErrorMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível concluir o login com Google.'
      );
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <p className="text-sm font-medium text-stone-600">Verificando credenciais...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-stone-200 p-6 sm:p-8 shadow-sm">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-[#111111] mb-6 cursor-pointer min-h-[40px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para a loja</span>
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-2">
            Área Restrita
          </p>
          <h1 className="font-display text-2xl font-extrabold text-[#111111] mb-2">
            Painel Administrativo
          </h1>
          <p className="text-sm text-stone-600 mb-6 leading-relaxed">
            Acesso exclusivo para gerenciamento do catálogo, estoque por numeração, marcas, banner e
            configurações da {storeConfig.storeName || 'Samuka Tênis'}.
          </p>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-[#C8102E]">
              {errorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleLogin}
            className="w-full py-3.5 px-5 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer min-h-[48px]"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white border border-stone-200 p-6 sm:p-8">
          <Shield className="w-8 h-8 text-[#C8102E] mb-3" />
          <h1 className="font-display text-xl font-extrabold text-[#111111] mb-2">
            Acesso não autorizado
          </h1>
          <p className="text-sm text-stone-600 mb-6">
            A conta <strong>{user.email}</strong> não possui permissão de administrador para editar
            o catálogo da Samuka Tênis.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer min-h-[44px]"
            >
              Trocar conta
            </button>
            <button
              type="button"
              onClick={onBackToStore}
              className="px-4 py-3 border border-stone-300 text-xs font-bold uppercase tracking-wider text-[#111111] cursor-pointer min-h-[44px]"
            >
              Ir para a loja
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleOpenNewProduct = () => {
    const defaultBrand = brands[0] || { id: 'nike', name: 'Nike' };
    setIsNewProduct(true);
    setWebLookupResult(null);
    setWebSearchQuery('');
    setNewVideoUrlInput('');
    setImportedUrlMap({});
    setAutoImportingPhotos(false);
    setEditingProduct({
      ...EMPTY_PRODUCT_FORM,
      brandId: defaultBrand.id,
      brandName: defaultBrand.name,
      sizes: { ...EMPTY_PRODUCT_FORM.sizes },
      colors: [],
      images: [],
      videos: [],
      costPrice: 0,
    });
  };

  const handleOpenEditProduct = (prod: Product) => {
    setIsNewProduct(false);
    setWebLookupResult(null);
    setWebSearchQuery('');
    setNewVideoUrlInput('');
    setImportedUrlMap({});
    setAutoImportingPhotos(false);
    setEditingProduct({
      ...prod,
      costPrice: prod.costPrice ?? 0,
      colors: [...(prod.colors || [])],
      images: [...(prod.images || [])],
      videos: [...(prod.videos || [])],
      sizes: { ...(prod.sizes || {}) },
    });
  };

  const handleOpenStockModal = (prod: Product) => {
    setStockModalProduct(prod);
    setStockDraftSizes({ ...(prod.sizes || {}) });
    setStockModalCustomSize('');
  };

  const handleSaveQuickStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    setSavingStockModal(true);
    try {
      await updateProductStock(stockModalProduct.id, stockDraftSizes);
      setStockModalProduct(null);
      await loadAdminCollections();
      await onRefreshStorefront();
      notify(`Estoque de "${stockModalProduct.name}" atualizado!`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao atualizar estoque.');
    } finally {
      setSavingStockModal(false);
    }
  };

  const handleWebSneakerSearch = async () => {
    const q = webSearchQuery.trim();
    if (q.length < 2) {
      setErrorMessage('Digite o nome e/ou cor do tênis para buscar (ex: 9060 Azul).');
      return;
    }
    setWebSearching(true);
    setErrorMessage('');
    try {
      const result = await searchSneakerOnWeb(q);
      const previousAutoImages = new Set<string>([
        ...(webLookupResult?.imageUrls || []),
        ...Object.values(importedUrlMap),
      ]);
      const previousAutoVideos = new Set<string>(webLookupResult?.videoUrls || []);

      setWebLookupResult(result);
      setImportedUrlMap({});

      // Match brand from pre-configured brands
      const matchedBrand = brands.find(
        (b) =>
          b.name.toLowerCase() === result.brandName.toLowerCase() ||
          result.name.toLowerCase().includes(b.name.toLowerCase())
      );

      const initialAutoImages = (result.imageUrls || []).slice(0, 4);
      const initialAutoVideos = (result.videoUrls || []).slice(0, 1);

      setEditingProduct((prev) => {
        if (!prev) return prev;
        const preservedManualImages = prev.images.filter((img) => !previousAutoImages.has(img));
        const nextImages = Array.from(
          new Set([...preservedManualImages, ...initialAutoImages])
        ).slice(0, 8);

        const preservedManualVideos = (prev.videos || []).filter(
          (vid) => !previousAutoVideos.has(vid)
        );
        const nextVideos =
          preservedManualVideos.length > 0
            ? preservedManualVideos.slice(0, 4)
            : Array.from(new Set([...preservedManualVideos, ...initialAutoVideos])).slice(0, 4);

        return {
          ...prev,
          name: result.name || prev.name,
          brandId: matchedBrand?.id || prev.brandId,
          brandName: matchedBrand?.name || result.brandName || prev.brandName,
          description: result.description || prev.description,
          details: result.details || prev.details,
          gender: result.gender || prev.gender,
          type: result.type || prev.type,
          occasion: result.occasion || prev.occasion,
          colors: result.colors.length > 0 ? result.colors : prev.colors,
          price: prev.price > 0 ? prev.price : result.suggestedPrice,
          images: nextImages,
          videos: nextVideos,
        };
      });

      if (initialAutoImages.length > 0) {
        setAutoImportingPhotos(true);
        void Promise.all(
          initialAutoImages.map(async (remoteUrl) => {
            try {
              const storedUrl = await importRemoteImageToStore(remoteUrl);
              return { remoteUrl, storedUrl };
            } catch {
              return { remoteUrl, storedUrl: remoteUrl };
            }
          })
        )
          .then((pairs) => {
            setImportedUrlMap((prev) => {
              const next = { ...prev };
              pairs.forEach(({ remoteUrl, storedUrl }) => {
                next[remoteUrl] = storedUrl;
              });
              return next;
            });
            setEditingProduct((prev) => {
              if (!prev) return prev;
              const replaceMap = new Map(pairs.map((p) => [p.remoteUrl, p.storedUrl]));
              const updatedImages = prev.images.map((img) => replaceMap.get(img) || img);
              return {
                ...prev,
                images: Array.from(new Set(updatedImages)).slice(0, 8),
              };
            });
          })
          .finally(() => {
            setAutoImportingPhotos(false);
          });
      }

      const photoCount = initialAutoImages.length;
      const videoCount = initialAutoVideos.length;
      notify(
        result.warning ||
          `Dados preenchidos! ${photoCount} foto(s)${
            videoCount > 0 ? ` e ${videoCount} vídeo` : ''
          } adicionado(s) ao anúncio.`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao buscar informações do tênis na web.'
      );
    } finally {
      setWebSearching(false);
    }
  };

  const handleImportFoundImage = async (imageUrl: string) => {
    if (!editingProduct) return;
    const mappedUrl = importedUrlMap[imageUrl] || imageUrl;
    const isAlreadyAdded =
      editingProduct.images.includes(imageUrl) || editingProduct.images.includes(mappedUrl);

    if (isAlreadyAdded) {
      setEditingProduct((prev) =>
        prev
          ? {
              ...prev,
              images: prev.images.filter((img) => img !== imageUrl && img !== mappedUrl),
            }
          : prev
      );
      notify('Foto removida do anúncio.');
      return;
    }

    setImportingImageUrl(imageUrl);
    setErrorMessage('');
    try {
      const storedUrl = await importRemoteImageToStore(imageUrl);
      setImportedUrlMap((prev) => ({ ...prev, [imageUrl]: storedUrl }));
      setEditingProduct((prev) => {
        if (!prev) return prev;
        if (prev.images.includes(storedUrl) || prev.images.includes(imageUrl)) return prev;
        return { ...prev, images: [...prev.images, storedUrl].slice(0, 8) };
      });
      notify('Foto adicionada ao anúncio!');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar foto.');
    } finally {
      setImportingImageUrl(null);
    }
  };

  const handleToggleFoundVideo = (videoUrl: string) => {
    if (!editingProduct) return;
    const currentVideos = editingProduct.videos || [];
    if (currentVideos.includes(videoUrl)) {
      setEditingProduct((prev) =>
        prev ? { ...prev, videos: (prev.videos || []).filter((v) => v !== videoUrl) } : prev
      );
      notify('Vídeo removido do anúncio.');
      return;
    }
    setEditingProduct((prev) =>
      prev ? { ...prev, videos: [...(prev.videos || []), videoUrl].slice(0, 4) } : prev
    );
    notify('Vídeo adicionado ao anúncio!');
  };

  const handleUploadProductFiles = async (files: FileList | null) => {
    if (!files || !editingProduct) return;
    setUploadingImage(true);
    setErrorMessage('');
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files).slice(0, 6)) {
        const url = await uploadProductOrBrandImage(file);
        uploadedUrls.push(url);
      }
      setEditingProduct((prev) =>
        prev ? { ...prev, images: [...prev.images, ...uploadedUrls].slice(0, 8) } : prev
      );
      notify('Imagem enviada com sucesso.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao enviar imagem.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadProductVideoFiles = async (files: FileList | null) => {
    if (!files || !files[0] || !editingProduct) return;
    setUploadingVideo(true);
    setErrorMessage('');
    try {
      const url = await uploadProductVideo(files[0]);
      setEditingProduct((prev) =>
        prev
          ? { ...prev, videos: [...(prev.videos || []), url].slice(0, 4) }
          : prev
      );
      notify('Vídeo enviado e adicionado ao produto!');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao enviar vídeo.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editingProduct.name.trim()) {
      setErrorMessage('Informe o nome do tênis.');
      return;
    }

    try {
      const selectedBrand = brands.find((b) => b.id === editingProduct.brandId);
      await saveProduct(
        {
          ...editingProduct,
          brandName: selectedBrand?.name || editingProduct.brandName || 'Nike',
          slug: slugify(editingProduct.slug || editingProduct.name),
        },
        isNewProduct
      );
      setEditingProduct(null);
      setWebLookupResult(null);
      await loadAdminCollections();
      await onRefreshStorefront();
      notify(isNewProduct ? 'Produto cadastrado com sucesso.' : 'Produto atualizado com sucesso.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      await loadAdminCollections();
      await onRefreshStorefront();
      notify('Produto removido.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao excluir produto.');
    }
  };

  const handleQuickToggleProduct = async (
    prod: Product,
    field: 'active' | 'outOfStock' | 'isFeatured' | 'isNewRelease' | 'isPromo'
  ) => {
    try {
      await saveProduct({ ...prod, [field]: !prod[field] }, false);
      await loadAdminCollections();
      await onRefreshStorefront();
      notify('Status do produto atualizado.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao atualizar produto.');
    }
  };

  const handleUploadBrandLogo = async (files: FileList | null) => {
    if (!files || !files[0] || !editingBrand) return;
    setUploadingImage(true);
    try {
      const url = await uploadProductOrBrandImage(files[0]);
      setEditingBrand((prev) => (prev ? { ...prev, logoUrl: url } : prev));
      notify('Logotipo enviado.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao enviar logotipo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveBrandForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand || !editingBrand.name.trim()) return;
    try {
      await saveBrand(
        {
          ...editingBrand,
          id: editingBrand.id || slugify(editingBrand.name),
          slug: slugify(editingBrand.slug || editingBrand.name),
        },
        isNewBrand
      );
      setEditingBrand(null);
      await loadAdminCollections();
      await onRefreshStorefront();
      notify('Marca salva com sucesso.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar marca.');
    }
  };

  const handleUploadHeroImage = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setUploadingImage(true);
    try {
      const url = await uploadProductOrBrandImage(files[0]);
      setConfigDraft((prev) => ({ ...prev, heroImageUrl: url }));
      notify('Imagem do banner carregada. Clique em Salvar para publicar.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao enviar imagem do banner.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveStoreConfig(configDraft);
      await onRefreshStorefront();
      notify('Configurações salvas e publicadas na loja.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    }
  };

  const handleSeedBrands = async () => {
    try {
      await seedInitialBrandsToFirestore(true);
      await loadAdminCollections();
      await onRefreshStorefront();
      notify('As 11 marcas iniciais foram sincronizadas no banco.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar marcas.');
    }
  };

  const handleSeedProducts = async () => {
    try {
      await seedInitialBrandsToFirestore();
      await seedStarterShowcaseToFirestore();
      await loadAdminCollections();
      await onRefreshStorefront();
      notify('Vitrine inicial importada para o banco de dados.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar produtos.');
    }
  };

  const filteredAdminProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.brandName}`.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] pb-16">
      {/* Mobile-Friendly Admin Header */}
      <header className="sticky top-0 z-30 bg-[#111111] text-white border-b border-stone-800">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-10 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold uppercase tracking-wider text-stone-200 hover:text-white cursor-pointer shrink-0 min-h-[40px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Loja</span>
            </button>
            <span className="text-stone-700 hidden sm:inline">|</span>
            <h1 className="font-display text-xs sm:text-base font-extrabold tracking-tight truncate">
              ADMIN · {storeConfig.storeName || 'SAMUKA TÊNIS'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden lg:inline text-xs text-stone-400">{user.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-800 hover:bg-stone-700 text-xs font-semibold cursor-pointer min-h-[38px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-10 py-5 sm:py-8">
        {/* Feedback Banners */}
        {statusMessage && (
          <div className="mb-5 p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mb-5 p-3.5 sm:p-4 bg-red-50 border border-red-200 text-[#C8102E] text-xs sm:text-sm font-medium">
            {errorMessage}
          </div>
        )}

        {/* Mobile-Optimized Scrollable Navigation Tabs */}
        {(() => {
          const pendingOrdersCount = orders.filter((o) => o.status === 'pendente').length;
          return (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-6 border-b border-stone-200">
              {[
                { key: 'produtos' as AdminTab, label: 'Produtos & Estoque', icon: Package, badge: 0 },
                {
                  key: 'pedidos' as AdminTab,
                  label: 'Pedidos',
                  icon: ClipboardList,
                  badge: pendingOrdersCount,
                },
                { key: 'lucros' as AdminTab, label: 'Calculadora de Lucros', icon: Calculator, badge: 0 },
                { key: 'marcas' as AdminTab, label: 'Marcas', icon: Tag, badge: 0 },
                { key: 'pagina_inicial' as AdminTab, label: 'Banner', icon: Sparkles, badge: 0 },
                { key: 'configuracoes' as AdminTab, label: 'Configurações', icon: Settings, badge: 0 },
                ...(user.email === PRIMARY_OWNER_EMAIL
                  ? [{ key: 'equipe' as AdminTab, label: 'Equipe', icon: Users, badge: 0 }]
                  : []),
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[44px] ${
                      active
                        ? 'bg-[#111111] text-white'
                        : 'bg-white border border-stone-200 text-stone-700 hover:border-[#111111]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.badge > 0 && (
                      <span
                        className={`font-mono-num px-1.5 py-0.5 text-[10px] font-extrabold ${
                          active ? 'bg-[#C8102E] text-white' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* TAB 1: PRODUTOS & ESTOQUE */}
        {activeTab === 'produtos' && (
          <div className="space-y-5 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-extrabold">
                  Catálogo & Numerações
                </h2>
                <p className="text-xs sm:text-sm text-stone-600">
                  Pesquise tênis na web para preencher automático ou cadastre manualmente.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:flex gap-2">
                {products.length === 0 && (
                  <button
                    type="button"
                    onClick={handleSeedProducts}
                    className="px-4 py-3 border border-[#111111] bg-white text-[#111111] text-xs font-bold uppercase tracking-wider hover:bg-stone-100 cursor-pointer min-h-[44px]"
                  >
                    Importar vitrine inicial
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenNewProduct}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#C8102E] transition-colors cursor-pointer min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Tênis / Importar da Web</span>
                </button>
              </div>
            </div>

            {/* Product Editor Panel */}
            {editingProduct && (
              <form
                onSubmit={handleSaveProductForm}
                className="bg-white border border-[#111111] p-4 sm:p-8 space-y-6 shadow-md"
              >
                <div className="flex items-center justify-between border-b border-stone-200 pb-3.5">
                  <h3 className="font-display text-base sm:text-lg font-extrabold truncate pr-2">
                    {isNewProduct ? 'Novo tênis no catálogo' : `Editando: ${editingProduct.name}`}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setWebLookupResult(null);
                    }}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-stone-600 hover:text-[#111111] cursor-pointer shrink-0"
                  >
                    Fechar
                  </button>
                </div>

                {/* Smart Web Sneaker Importer */}
                <div className="bg-[#FAFAFA] border border-stone-300 p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-2.5">
                    <Globe className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-display text-sm font-extrabold text-[#111111]">
                        Importação Inteligente da Web
                      </h4>
                      <p className="text-xs text-stone-600">
                        Digite o modelo e a cor (ex: <strong>9060 Azul</strong>,{' '}
                        <strong>Nike Shox TL Preto</strong>) para buscar descrição, detalhes,
                        cores, fotos da cor e vídeos automaticamente.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={webSearchQuery}
                        onChange={(e) => setWebSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleWebSneakerSearch();
                          }
                        }}
                        placeholder="Ex: New Balance 9060 Azul, Nike Shox TL Preto"
                        className="w-full pl-9 pr-3 py-3 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111] min-h-[44px]"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={webSearching}
                      onClick={() => void handleWebSneakerSearch()}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#C8102E] hover:bg-[#111111] text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-60 cursor-pointer min-h-[44px] shrink-0"
                    >
                      {webSearching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Buscando...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span>Buscar e preencher</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Discovered Images, Videos & Sources */}
                  {webLookupResult && (
                    <div className="space-y-4 pt-2 border-t border-stone-200">
                      {webLookupResult.imageUrls.length > 0 ? (
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-bold uppercase tracking-wider text-stone-700">
                              Fotos encontradas (as principais já foram incluídas no anúncio):
                            </p>
                            {autoImportingPhotos && (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-stone-600">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Salvando fotos na galeria...
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            {webLookupResult.imageUrls.map((url) => {
                              const isImporting = importingImageUrl === url;
                              const mappedUrl = importedUrlMap[url] || url;
                              const inAd =
                                editingProduct.images.includes(url) ||
                                editingProduct.images.includes(mappedUrl);
                              return (
                                <div
                                  key={url}
                                  className={`bg-white border p-1.5 flex flex-col gap-1.5 ${
                                    inAd ? 'border-emerald-600 ring-1 ring-emerald-600/20' : 'border-stone-200'
                                  }`}
                                >
                                  <div className="relative aspect-[4/3] bg-[#F5F5F4] overflow-hidden">
                                    <SmartImage
                                      src={url}
                                      alt="Sugestão encontrada na web"
                                      className="w-full h-full object-cover"
                                    />
                                    {inAd && (
                                      <span className="absolute top-1 left-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-700 text-white text-[10px] font-bold uppercase">
                                        <Check className="w-3 h-3" />
                                        No anúncio
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isImporting}
                                    onClick={() => void handleImportFoundImage(url)}
                                    className={`w-full py-2 text-[11px] font-bold uppercase cursor-pointer disabled:opacity-50 transition-colors ${
                                      inAd
                                        ? 'bg-emerald-50 hover:bg-red-50 text-emerald-800 hover:text-[#C8102E] border border-emerald-200 hover:border-red-200'
                                        : 'bg-[#111111] hover:bg-[#C8102E] text-white'
                                    }`}
                                  >
                                    {isImporting
                                      ? 'Importando...'
                                      : inAd
                                        ? '✓ No anúncio (Remover)'
                                        : '+ Usar foto'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-stone-600">
                          Os dados de texto foram preenchidos. Caso nenhuma foto direta tenha sido
                          liberada pelos sites, envie sua foto abaixo ou cole a URL da imagem.
                        </p>
                      )}

                      {/* Discovered Videos */}
                      {webLookupResult.videos && webLookupResult.videos.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                            Vídeos encontrados para este modelo:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {webLookupResult.videos.map((vid) => {
                              const inAd = (editingProduct.videos || []).includes(vid.url);
                              const ytMatch = vid.url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                              const thumbUrl = ytMatch
                                ? `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`
                                : '';
                              return (
                                <div
                                  key={vid.url}
                                  className={`bg-white border p-2 flex items-center gap-2.5 ${
                                    inAd ? 'border-emerald-600 ring-1 ring-emerald-600/20' : 'border-stone-200'
                                  }`}
                                >
                                  <a
                                    href={vid.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative w-24 aspect-video bg-black shrink-0 overflow-hidden group"
                                    title="Assistir no YouTube"
                                  >
                                    {thumbUrl ? (
                                      <img
                                        src={thumbUrl}
                                        alt={vid.title}
                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-white">
                                        <Film className="w-5 h-5" />
                                      </div>
                                    )}
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <Play className="w-5 h-5 text-white fill-white" />
                                    </span>
                                  </a>
                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <p className="text-xs font-semibold text-[#111111] line-clamp-2 leading-snug">
                                      {vid.title}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFoundVideo(vid.url)}
                                      className={`px-2.5 py-1.5 text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                                        inAd
                                          ? 'bg-emerald-50 hover:bg-red-50 text-emerald-800 hover:text-[#C8102E] border border-emerald-200'
                                          : 'bg-[#111111] hover:bg-[#C8102E] text-white'
                                      }`}
                                    >
                                      {inAd ? '✓ No anúncio (Remover)' : '+ Usar vídeo'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {webLookupResult.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                          <span>Fontes consultadas:</span>
                          {webLookupResult.sources.map((src) => (
                            <a
                              key={src.uri}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 underline hover:text-[#111111]"
                            >
                              <span className="truncate max-w-[160px]">{src.title}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Basic Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Nome do modelo *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingProduct.name}
                      onChange={(e) =>
                        setEditingProduct((p) => (p ? { ...p, name: e.target.value } : p))
                      }
                      placeholder="Ex: Nike Shox R4"
                      className="w-full px-3 py-3 border border-stone-300 text-sm focus:outline-none focus:border-[#111111] min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Marca *
                    </label>
                    <select
                      value={editingProduct.brandId}
                      onChange={(e) => {
                        const b = brands.find((item) => item.id === e.target.value);
                        setEditingProduct((p) =>
                          p
                            ? {
                                ...p,
                                brandId: e.target.value,
                                brandName: b?.name || e.target.value,
                              }
                            : p
                        );
                      }}
                      className="w-full px-3 py-3 border border-stone-300 text-sm bg-white focus:outline-none focus:border-[#111111] min-h-[44px]"
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Preço normal (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={editingProduct.price}
                      onChange={(e) =>
                        setEditingProduct((p) =>
                          p ? { ...p, price: Number(e.target.value) } : p
                        )
                      }
                      className="font-mono-num w-full px-3 py-3 border border-stone-300 text-sm focus:outline-none focus:border-[#111111] min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Preço promocional (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingProduct.promoPrice}
                      onChange={(e) =>
                        setEditingProduct((p) =>
                          p ? { ...p, promoPrice: Number(e.target.value) } : p
                        )
                      }
                      className="font-mono-num w-full px-3 py-3 border border-stone-300 text-sm focus:outline-none focus:border-[#111111] min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Custo de compra (R$ · interno)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingProduct.costPrice ?? 0}
                      onChange={(e) =>
                        setEditingProduct((p) =>
                          p ? { ...p, costPrice: Number(e.target.value) } : p
                        )
                      }
                      placeholder="Ex: 180.00"
                      className="font-mono-num w-full px-3 py-3 border border-stone-300 text-sm focus:outline-none focus:border-[#111111] min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Gênero
                    </label>
                    <select
                      value={editingProduct.gender}
                      onChange={(e) =>
                        setEditingProduct((p) =>
                          p ? { ...p, gender: e.target.value as GenderOption } : p
                        )
                      }
                      className="w-full px-3 py-3 border border-stone-300 text-sm bg-white min-h-[44px]"
                    >
                      {Object.entries(GENDER_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Categoria / Tipo
                    </label>
                    <select
                      value={editingProduct.type}
                      onChange={(e) =>
                        setEditingProduct((p) =>
                          p ? { ...p, type: e.target.value as SneakerType } : p
                        )
                      }
                      className="w-full px-3 py-3 border border-stone-300 text-sm bg-white min-h-[44px]"
                    >
                      {Object.entries(SNEAKER_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Ocasião de uso
                    </label>
                    <input
                      type="text"
                      value={editingProduct.occasion}
                      onChange={(e) =>
                        setEditingProduct((p) => (p ? { ...p, occasion: e.target.value } : p))
                      }
                      placeholder="Ex: Corrida e Treino, Dia a dia, Eventos casuais"
                      className="w-full px-3 py-3 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Descriptions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Descrição do produto
                    </label>
                    <textarea
                      rows={3}
                      value={editingProduct.description}
                      onChange={(e) =>
                        setEditingProduct((p) => (p ? { ...p, description: e.target.value } : p))
                      }
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                      Informações técnicas (materiais, solado)
                    </label>
                    <textarea
                      rows={3}
                      value={editingProduct.details}
                      onChange={(e) =>
                        setEditingProduct((p) => (p ? { ...p, details: e.target.value } : p))
                      }
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                    />
                  </div>
                </div>

                {/* Flags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                  {[
                    { key: 'active' as const, label: 'Publicado na loja' },
                    { key: 'isPromo' as const, label: 'Ativar preço promocional' },
                    { key: 'isFeatured' as const, label: 'Mais vendido / Destaque' },
                    { key: 'isNewRelease' as const, label: 'Lançamento' },
                    { key: 'outOfStock' as const, label: 'Marcar como esgotado' },
                  ].map((flag) => (
                    <label
                      key={flag.key}
                      className="inline-flex items-center gap-2.5 p-2.5 border border-stone-200 bg-stone-50 text-sm cursor-pointer min-h-[44px]"
                    >
                      <input
                        type="checkbox"
                        checked={editingProduct[flag.key]}
                        onChange={(e) =>
                          setEditingProduct((p) =>
                            p ? { ...p, [flag.key]: e.target.checked } : p
                          )
                        }
                        className="w-4 h-4 accent-[#111111]"
                      />
                      <span>{flag.label}</span>
                    </label>
                  ))}
                </div>

                {/* Colors */}
                <div className="border-t border-stone-200 pt-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                    Cores disponíveis
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {editingProduct.colors.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 border border-stone-300 text-xs font-semibold"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() =>
                            setEditingProduct((p) =>
                              p ? { ...p, colors: p.colors.filter((item) => item !== c) } : p
                            )
                          }
                          className="text-stone-500 hover:text-[#C8102E] cursor-pointer px-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 max-w-sm">
                    <input
                      type="text"
                      value={newColorInput}
                      onChange={(e) => setNewColorInput(e.target.value)}
                      placeholder="Ex: Preto, Branco, Prata"
                      className="flex-1 px-3 py-2.5 border border-stone-300 text-sm min-h-[42px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const c = newColorInput.trim();
                        if (!c) return;
                        setEditingProduct((p) =>
                          p && !p.colors.includes(c)
                            ? { ...p, colors: [...p.colors, c] }
                            : p
                        );
                        setNewColorInput('');
                      }}
                      className="px-4 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase cursor-pointer min-h-[42px]"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {/* Images Upload & Presets */}
                <div className="border-t border-stone-200 pt-5 space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                    Fotografias do tênis (até 8 imagens)
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-stone-800 min-h-[44px] shrink-0">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Enviando...' : 'Enviar do celular/PC'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={(e) => void handleUploadProductFiles(e.target.files)}
                        className="hidden"
                      />
                    </label>

                    <div className="flex gap-2 flex-1">
                      <input
                        type="url"
                        value={newImageUrlInput}
                        onChange={(e) => setNewImageUrlInput(e.target.value)}
                        placeholder="Ou cole a URL da imagem (https://...)"
                        className="flex-1 px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = newImageUrlInput.trim();
                          if (!url) return;
                          setEditingProduct((p) =>
                            p ? { ...p, images: [...p.images, url].slice(0, 8) } : p
                          );
                          setNewImageUrlInput('');
                        }}
                        className="px-4 py-2.5 border border-[#111111] text-xs font-bold uppercase cursor-pointer min-h-[44px] shrink-0"
                      >
                        Incluir
                      </button>
                    </div>
                  </div>

                  {/* Studio Presets Picker */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-stone-500">Fotos de estúdio:</span>
                    {STUDIO_IMAGE_PRESETS.slice(1).map((preset) => (
                      <button
                        key={preset.url}
                        type="button"
                        onClick={() =>
                          setEditingProduct((p) =>
                            p ? { ...p, images: [...p.images, preset.url].slice(0, 8) } : p
                          )
                        }
                        className="px-2.5 py-1.5 border border-stone-300 hover:border-[#111111] bg-stone-50 text-stone-700 cursor-pointer"
                      >
                        + {preset.label}
                      </button>
                    ))}
                  </div>

                  {editingProduct.images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                      {editingProduct.images.map((img, idx) => (
                        <div key={`${img}-${idx}`} className="relative border border-stone-200 bg-[#F5F5F4]">
                          <div className="aspect-[4/3]">
                            <SmartImage
                              src={img}
                              alt={`Foto ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingProduct((p) =>
                                p
                                  ? { ...p, images: p.images.filter((_, i) => i !== idx) }
                                  : p
                              )
                            }
                            className="absolute top-1 right-1 px-2 py-1 bg-black/80 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Remover
                          </button>
                          {idx === 0 && (
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-white text-[10px] font-bold">
                              Principal
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product Videos Upload & URLs */}
                <div className="border-t border-stone-200 pt-5 space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                      Vídeos do tênis (até 4 vídeos · MP4, WebM, YouTube ou Vimeo)
                    </label>
                    <p className="text-xs text-stone-500">
                      Envie um vídeo curto do celular/PC ou cole o link do YouTube / Shorts / MP4.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-stone-800 min-h-[44px] shrink-0">
                      <Film className="w-3.5 h-3.5" />
                      <span>{uploadingVideo ? 'Enviando vídeo...' : 'Enviar vídeo'}</span>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        disabled={uploadingVideo}
                        onChange={(e) => void handleUploadProductVideoFiles(e.target.files)}
                        className="hidden"
                      />
                    </label>

                    <div className="flex gap-2 flex-1">
                      <input
                        type="url"
                        value={newVideoUrlInput}
                        onChange={(e) => setNewVideoUrlInput(e.target.value)}
                        placeholder="Ou cole o link do YouTube / Shorts / MP4 (https://...)"
                        className="flex-1 px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const url = sanitizeVideoUrl(newVideoUrlInput);
                          if (!url) {
                            setErrorMessage('Informe uma URL de vídeo válida (https://...).');
                            return;
                          }
                          setEditingProduct((p) =>
                            p ? { ...p, videos: [...(p.videos || []), url].slice(0, 4) } : p
                          );
                          setNewVideoUrlInput('');
                        }}
                        className="px-4 py-2.5 border border-[#111111] text-xs font-bold uppercase cursor-pointer min-h-[44px] shrink-0"
                      >
                        Incluir Vídeo
                      </button>
                    </div>
                  </div>

                  {(editingProduct.videos || []).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {(editingProduct.videos || []).map((vid, idx) => {
                        const parsed = parseVideoSource(vid);
                        return (
                          <div key={`${vid}-${idx}`} className="border border-stone-200 bg-[#FAFAFA] p-2 space-y-2">
                            <div className="aspect-video bg-black overflow-hidden">
                              {parsed.kind === 'youtube' || parsed.kind === 'vimeo' ? (
                                <iframe
                                  src={parsed.src}
                                  title={`Prévia vídeo ${idx + 1}`}
                                  className="w-full h-full border-0"
                                  allowFullScreen
                                />
                              ) : (
                                <video
                                  src={parsed.src}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="w-full h-full object-contain"
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-stone-500 truncate">{vid}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingProduct((p) =>
                                    p
                                      ? {
                                          ...p,
                                          videos: (p.videos || []).filter((_, i) => i !== idx),
                                        }
                                      : p
                                  )
                                }
                                className="px-2 py-1 bg-[#C8102E] text-white text-[10px] font-bold uppercase cursor-pointer shrink-0"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Configurable Size Grid */}
                <div className="border-t border-stone-200 pt-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                        Grade de numerações e estoque por tamanho
                      </label>
                      <p className="text-xs text-stone-500">
                        Quantidade 0 desabilita automaticamente a numeração.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, number> = {};
                          ALL_STANDARD_SIZES.forEach((s) => {
                            next[s] = editingProduct.sizes[s] ?? 1;
                          });
                          setEditingProduct((p) => (p ? { ...p, sizes: next } : p));
                        }}
                        className="px-3 py-2 border border-stone-300 text-xs font-semibold hover:border-[#111111] cursor-pointer min-h-[38px]"
                      >
                        Grade 34–44
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, number> = {};
                          KIDS_SIZES.forEach((s) => {
                            next[s] = editingProduct.sizes[s] ?? 1;
                          });
                          setEditingProduct((p) => (p ? { ...p, sizes: next } : p));
                        }}
                        className="px-3 py-2 border border-stone-300 text-xs font-semibold hover:border-[#111111] cursor-pointer min-h-[38px]"
                      >
                        Grade Infantil 26–33
                      </button>
                    </div>
                  </div>

                  {/* Bulk Stock Setter */}
                  <div className="flex flex-wrap items-center gap-2 bg-[#FAFAFA] border border-stone-200 p-2.5 text-xs">
                    <span className="font-semibold text-stone-600">Aplicar estoque em lote:</span>
                    <input
                      type="number"
                      min="0"
                      value={bulkStockValue}
                      onChange={(e) =>
                        setBulkStockValue(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                      }
                      className="font-mono-num w-16 px-2 py-1.5 border border-stone-300 text-center bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next: Record<string, number> = {};
                        Object.keys(editingProduct.sizes).forEach((s) => {
                          next[s] = bulkStockValue;
                        });
                        setEditingProduct((p) => (p ? { ...p, sizes: next } : p));
                      }}
                      className="px-3 py-1.5 bg-[#111111] text-white font-bold uppercase cursor-pointer"
                    >
                      Aplicar a todos os tamanhos
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2">
                    {Object.entries(editingProduct.sizes)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([size, qty]) => (
                        <div
                          key={size}
                          className={`p-2 border text-center ${
                            qty > 0 ? 'border-[#111111] bg-white' : 'border-stone-200 bg-stone-50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono-num text-xs font-bold">{size}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const copy = { ...editingProduct.sizes };
                                delete copy[size];
                                setEditingProduct((p) => (p ? { ...p, sizes: copy } : p));
                              }}
                              className="text-xs text-stone-400 hover:text-[#C8102E] cursor-pointer px-1"
                              title="Remover numeração"
                            >
                              ×
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setEditingProduct((p) =>
                                  p
                                    ? {
                                        ...p,
                                        sizes: { ...p.sizes, [size]: Math.max(0, qty - 1) },
                                      }
                                    : p
                                )
                              }
                              className="p-1.5 border border-stone-300 hover:border-[#111111] cursor-pointer"
                              aria-label={`Diminuir tamanho ${size}`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={qty}
                              onChange={(e) => {
                                const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                                setEditingProduct((p) =>
                                  p ? { ...p, sizes: { ...p.sizes, [size]: val } } : p
                                );
                              }}
                              className="font-mono-num w-full text-center py-1 border border-stone-300 text-xs min-h-[34px]"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEditingProduct((p) =>
                                  p ? { ...p, sizes: { ...p.sizes, [size]: qty + 1 } } : p
                                )
                              }
                              className="p-1.5 border border-stone-300 hover:border-[#111111] cursor-pointer"
                              aria-label={`Aumentar tamanho ${size}`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex gap-2 max-w-xs pt-1">
                    <input
                      type="text"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      placeholder="Outro tam. (ex: 45)"
                      className="font-mono-num flex-1 px-3 py-2 border border-stone-300 text-xs min-h-[40px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const s = customSizeInput.trim();
                        if (!s) return;
                        setEditingProduct((p) =>
                          p ? { ...p, sizes: { ...p.sizes, [s]: 1 } } : p
                        );
                        setCustomSizeInput('');
                      }}
                      className="px-4 py-2 bg-stone-800 text-white text-xs font-bold cursor-pointer min-h-[40px]"
                    >
                      + Tam
                    </button>
                  </div>
                </div>

                {/* Sticky Mobile Save Footer */}
                <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-stone-200 pt-4 pb-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setWebLookupResult(null);
                    }}
                    className="w-full sm:w-auto px-5 py-3 border border-stone-300 text-xs font-bold uppercase tracking-wider cursor-pointer min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer min-h-[44px]"
                  >
                    Salvar produto
                  </button>
                </div>
              </form>
            )}

            {/* Mobile-First Product List */}
            <div className="bg-white border border-stone-200">
              <div className="p-3.5 sm:p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <input
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Filtrar produtos cadastrados..."
                  className="px-3.5 py-2.5 border border-stone-300 text-sm w-full sm:w-80 focus:outline-none focus:border-[#111111] min-h-[42px]"
                />
                <span className="font-mono-num text-xs text-stone-500">
                  {filteredAdminProducts.length} produtos no banco
                </span>
              </div>

              {loadingData ? (
                <div className="p-8 text-center text-sm text-stone-500">Carregando...</div>
              ) : filteredAdminProducts.length === 0 ? (
                <div className="p-8 sm:p-10 text-center text-sm text-stone-500">
                  Nenhum produto cadastrado no banco ainda. Clique em{' '}
                  <strong>Novo Tênis / Importar da Web</strong> ou{' '}
                  <strong>Importar vitrine inicial</strong>.
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {filteredAdminProducts.map((prod) => {
                    const totalPairs = Object.values(prod.sizes || {}).reduce((a, b) => a + b, 0);
                    return (
                      <div
                        key={prod.id}
                        className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 hover:bg-stone-50"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-14 bg-[#F5F5F4] shrink-0 overflow-hidden">
                            <SmartImage
                              src={prod.images?.[0] || ''}
                              alt={prod.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-wider text-stone-500 truncate">
                              {prod.brandName} · {SNEAKER_TYPE_LABELS[prod.type] || prod.type}
                            </p>
                            <h4 className="font-display text-sm font-bold text-[#111111] truncate">
                              {prod.name}
                            </h4>
                            <p className="font-mono-num text-xs text-stone-600 mt-0.5">
                              {formatBRL(prod.price)}
                              {prod.isPromo && prod.promoPrice > 0
                                ? ` → ${formatBRL(prod.promoPrice)}`
                                : ''}{' '}
                              · Estoque: <strong>{totalPairs}</strong> pares
                              {(prod.videos?.length || 0) > 0 && ` · ${prod.videos!.length} vídeo(s)`}
                            </p>
                            {/* Size stock summary chips */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(prod.sizes || {})
                                .filter(([, qty]) => qty > 0)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([sz, qty]) => (
                                  <span
                                    key={sz}
                                    className="font-mono-num px-1.5 py-0.5 bg-stone-100 border border-stone-200 text-[10px] font-semibold text-stone-700"
                                  >
                                    {sz}: {qty}
                                  </span>
                                ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenStockModal(prod)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold cursor-pointer min-h-[40px] transition-colors"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            <span>Estoque</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleQuickToggleProduct(prod, 'active')}
                            className={`px-3 py-2 text-xs font-bold border cursor-pointer min-h-[40px] ${
                              prod.active
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-stone-100 border-stone-300 text-stone-500'
                            }`}
                          >
                            {prod.active ? 'Ativo' : 'Oculto'}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleQuickToggleProduct(prod, 'outOfStock')}
                            className={`px-3 py-2 text-xs font-bold border cursor-pointer min-h-[40px] ${
                              prod.outOfStock
                                ? 'bg-red-50 border-red-300 text-[#C8102E]'
                                : 'bg-white border-stone-300 text-stone-700'
                            }`}
                          >
                            {prod.outOfStock ? 'Esgotado' : 'Disponível'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(prod)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-stone-300 hover:border-[#111111] text-xs font-semibold cursor-pointer min-h-[40px]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteProduct(prod.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-stone-200 text-stone-500 hover:text-[#C8102E] hover:border-red-200 text-xs font-semibold cursor-pointer min-h-[40px]"
                            aria-label={`Excluir ${prod.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="sm:hidden">Excluir</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PEDIDOS */}
        {activeTab === 'pedidos' && (
          <OrdersTab
            orders={orders}
            products={products}
            onRefreshAll={async () => {
              await loadAdminCollections();
              await onRefreshStorefront();
            }}
            onNotify={notify}
            onError={(msg) => setErrorMessage(msg)}
          />
        )}

        {/* TAB: CALCULADORA DE LUCROS */}
        {activeTab === 'lucros' && (
          <ProfitCalculatorTab
            products={products}
            sales={sales}
            onRefreshAll={async () => {
              await loadAdminCollections();
              await onRefreshStorefront();
            }}
            onNotify={notify}
            onError={(msg) => setErrorMessage(msg)}
          />
        )}

        {/* TAB 2: MARCAS */}
        {activeTab === 'marcas' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-extrabold">
                  Marcas Pré-Configuradas
                </h2>
                <p className="text-xs sm:text-sm text-stone-600">
                  As 11 marcas principais já estão configuradas. Edite logotipos, ordem ou adicione
                  novas.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:flex gap-2">
                <button
                  type="button"
                  onClick={handleSeedBrands}
                  className="px-4 py-3 border border-[#111111] text-xs font-bold uppercase tracking-wider hover:bg-stone-100 cursor-pointer min-h-[44px]"
                >
                  Restaurar 11 marcas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewBrand(true);
                    setEditingBrand({
                      id: '',
                      name: '',
                      slug: '',
                      logoUrl: '',
                      order: brands.length + 1,
                      active: true,
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#C8102E] cursor-pointer min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Marca</span>
                </button>
              </div>
            </div>

            {editingBrand && (
              <form
                onSubmit={handleSaveBrandForm}
                className="bg-white border border-[#111111] p-4 sm:p-6 space-y-4 max-w-xl"
              >
                <h3 className="font-display text-base font-extrabold">
                  {isNewBrand ? 'Nova Marca' : `Editar: ${editingBrand.name}`}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Nome da marca *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingBrand.name}
                      onChange={(e) =>
                        setEditingBrand((b) => (b ? { ...b, name: e.target.value } : b))
                      }
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Ordem de exibição
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingBrand.order}
                      onChange={(e) =>
                        setEditingBrand((b) =>
                          b ? { ...b, order: Number(e.target.value) } : b
                        )
                      }
                      className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-stone-600">
                    Logotipo (Upload ou URL)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase cursor-pointer min-h-[44px]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingImage ? 'Enviando...' : 'Enviar Logo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handleUploadBrandLogo(e.target.files)}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="url"
                      value={editingBrand.logoUrl}
                      onChange={(e) =>
                        setEditingBrand((b) => (b ? { ...b, logoUrl: e.target.value } : b))
                      }
                      placeholder="https://... (opcional)"
                      className="flex-1 px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm cursor-pointer min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={editingBrand.active}
                    onChange={(e) =>
                      setEditingBrand((b) => (b ? { ...b, active: e.target.checked } : b))
                    }
                    className="w-4 h-4 accent-[#111111]"
                  />
                  <span>Exibir na loja</span>
                </label>

                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingBrand(null)}
                    className="px-4 py-2.5 border border-stone-300 text-xs font-bold uppercase cursor-pointer min-h-[44px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase cursor-pointer min-h-[44px]"
                  >
                    Salvar marca
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {brands.map((brand) => (
                <div
                  key={brand.id}
                  className="bg-white border border-stone-200 p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full border border-stone-200 flex items-center justify-center bg-white shrink-0">
                      <BrandLogo brand={brand} size="sm" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold truncate">{brand.name}</p>
                      <p className="font-mono-num text-[11px] text-stone-500">
                        Ordem: {brand.order} · {brand.active ? 'Ativa' : 'Oculta'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewBrand(false);
                        setEditingBrand({ ...brand });
                      }}
                      className="p-2.5 text-stone-600 hover:text-[#111111] cursor-pointer"
                      aria-label={`Editar ${brand.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteBrand(brand.id);
                        await loadAdminCollections();
                        await onRefreshStorefront();
                        notify('Marca removida.');
                      }}
                      className="p-2.5 text-stone-400 hover:text-[#C8102E] cursor-pointer"
                      aria-label={`Remover ${brand.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: BANNER & PÁGINA INICIAL */}
        {activeTab === 'pagina_inicial' && (
          <div className="space-y-6 sm:space-y-8">
            <form
              onSubmit={handleSaveConfig}
              className="bg-white border border-stone-200 p-4 sm:p-8 space-y-5"
            >
              <div>
                <h2 className="font-display text-lg sm:text-xl font-extrabold">Banner Principal</h2>
                <p className="text-xs sm:text-sm text-stone-600">
                  Substitua a imagem, título, subtítulo e o texto do botão principal da loja.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Título de impacto
                    </label>
                    <input
                      type="text"
                      required
                      value={configDraft.heroTitle}
                      onChange={(e) =>
                        setConfigDraft((c) => ({ ...c, heroTitle: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Subtítulo
                    </label>
                    <input
                      type="text"
                      value={configDraft.heroSubtitle}
                      onChange={(e) =>
                        setConfigDraft((c) => ({ ...c, heroSubtitle: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Texto do botão
                    </label>
                    <input
                      type="text"
                      required
                      value={configDraft.heroCtaText}
                      onChange={(e) =>
                        setConfigDraft((c) => ({ ...c, heroCtaText: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                      Imagem do banner (Upload ou URL)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <label className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase cursor-pointer min-h-[44px]">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>{uploadingImage ? 'Enviando...' : 'Enviar Banner'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => void handleUploadHeroImage(e.target.files)}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        value={configDraft.heroImageUrl}
                        onChange={(e) =>
                          setConfigDraft((c) => ({ ...c, heroImageUrl: e.target.value }))
                        }
                        className="flex-1 px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Mini Preview */}
                <div className="relative aspect-[16/9] bg-[#111111] overflow-hidden border border-stone-200 flex items-end p-5">
                  <SmartImage
                    src={configDraft.heroImageUrl}
                    alt="Prévia do banner"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
                  <div className="relative z-10 text-white max-w-sm">
                    <p className="font-display text-base sm:text-lg font-extrabold leading-tight mb-1">
                      {configDraft.heroTitle}
                    </p>
                    <p className="text-xs text-stone-200 mb-3">{configDraft.heroSubtitle}</p>
                    <span className="inline-block px-3 py-1.5 bg-white text-[#111111] text-[10px] font-bold uppercase">
                      {configDraft.heroCtaText}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer min-h-[44px]"
                >
                  Salvar Banner na Página Inicial
                </button>
              </div>
            </form>

            {/* Quick Vitrine Curation */}
            <div className="bg-white border border-stone-200 p-4 sm:p-6">
              <h3 className="font-display text-lg font-extrabold mb-1">
                Curadoria de Vitrines & Ofertas
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 mb-4">
                Marque quais modelos aparecem em Mais Vendidos, Lançamentos e Ofertas.
              </p>
              <div className="divide-y divide-stone-100">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div>
                      <span className="text-xs font-bold text-[#111111]">{prod.name}</span>
                      <span className="text-xs text-stone-500 ml-2">({prod.brandName})</span>
                    </div>
                    <div className="grid grid-cols-3 sm:flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleQuickToggleProduct(prod, 'isFeatured')}
                        className={`px-2.5 py-2 text-xs font-semibold border cursor-pointer min-h-[38px] ${
                          prod.isFeatured
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-white text-stone-600 border-stone-300'
                        }`}
                      >
                        Destaque
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQuickToggleProduct(prod, 'isNewRelease')}
                        className={`px-2.5 py-2 text-xs font-semibold border cursor-pointer min-h-[38px] ${
                          prod.isNewRelease
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-white text-stone-600 border-stone-300'
                        }`}
                      >
                        Lançamento
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQuickToggleProduct(prod, 'isPromo')}
                        className={`px-2.5 py-2 text-xs font-semibold border cursor-pointer min-h-[38px] ${
                          prod.isPromo
                            ? 'bg-[#C8102E] text-white border-[#C8102E]'
                            : 'bg-white text-stone-600 border-stone-300'
                        }`}
                      >
                        Oferta
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CONFIGURAÇÕES DA LOJA */}
        {activeTab === 'configuracoes' && (
          <form
            onSubmit={handleSaveConfig}
            className="bg-white border border-stone-200 p-4 sm:p-8 space-y-6 max-w-3xl"
          >
            <div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold">
                Atendimento, Endereço & Entregas
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">
                Configure os dados reais da loja usados no WhatsApp, retirada presencial e frete.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Nome da loja
                </label>
                <input
                  type="text"
                  required
                  value={configDraft.storeName}
                  onChange={(e) =>
                    setConfigDraft((c) => ({ ...c, storeName: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  WhatsApp comercial (DDD + Número)
                </label>
                <input
                  type="tel"
                  value={configDraft.whatsappNumber}
                  onChange={(e) =>
                    setConfigDraft((c) => ({
                      ...c,
                      whatsappNumber: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  placeholder="Ex: 5511999999999"
                  className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Instagram (URL completa ou @usuario)
                </label>
                <input
                  type="text"
                  value={configDraft.instagramUrl}
                  onChange={(e) =>
                    setConfigDraft((c) => ({ ...c, instagramUrl: e.target.value }))
                  }
                  placeholder="https://instagram.com/samukatenis"
                  className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Endereço físico da loja
                </label>
                <input
                  type="text"
                  value={configDraft.storeAddress}
                  onChange={(e) =>
                    setConfigDraft((c) => ({ ...c, storeAddress: e.target.value }))
                  }
                  placeholder="Rua, número, bairro, cidade/UF"
                  className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Horário de funcionamento
                </label>
                <input
                  type="text"
                  value={configDraft.openingHours}
                  onChange={(e) =>
                    setConfigDraft((c) => ({ ...c, openingHours: e.target.value }))
                  }
                  placeholder="Ex: Seg a Sáb, 09h às 19h"
                  className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                  Instruções para retirada na loja
                </label>
                <textarea
                  rows={2}
                  value={configDraft.pickupInfo}
                  onChange={(e) =>
                    setConfigDraft((c) => ({ ...c, pickupInfo: e.target.value }))
                  }
                  placeholder="Ex: Aguarde confirmação de separação pelo WhatsApp antes de retirar."
                  className="w-full px-3 py-2.5 border border-stone-300 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={configDraft.pickupFree}
                    onChange={(e) =>
                      setConfigDraft((c) => ({ ...c, pickupFree: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#111111]"
                  />
                  <span>Retirada presencial gratuita na loja</span>
                </label>
              </div>
            </div>

            {/* Shipping Configuration */}
            <div className="border-t border-stone-200 pt-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                Configuração de Frete
              </h3>
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  Modalidade de cálculo
                </label>
                <select
                  value={configDraft.shippingMode}
                  onChange={(e) =>
                    setConfigDraft((c) => ({
                      ...c,
                      shippingMode: e.target.value as ShippingMode,
                    }))
                  }
                  className="w-full px-3 py-2.5 border border-stone-300 text-sm bg-white min-h-[44px]"
                >
                  <option value="confirm_store">
                    Consultar CEP e confirmar valor/prazo na loja via WhatsApp
                  </option>
                  <option value="fixed_rate">
                    Taxa fixa estimada pela loja (sujeita a alterações)
                  </option>
                  <option value="external_api">
                    Endpoint externo de cotação de frete (JSON POST)
                  </option>
                </select>
              </div>

              {configDraft.shippingMode === 'fixed_rate' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Valor estimado do frete (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={configDraft.fixedShippingPrice}
                      onChange={(e) =>
                        setConfigDraft((c) => ({
                          ...c,
                          fixedShippingPrice: Number(e.target.value) || 0,
                        }))
                      }
                      className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Prazo estimado
                    </label>
                    <input
                      type="text"
                      value={configDraft.fixedShippingDays}
                      onChange={(e) =>
                        setConfigDraft((c) => ({ ...c, fixedShippingDays: e.target.value }))
                      }
                      placeholder="Ex: 2 a 5 dias úteis"
                      className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              {configDraft.shippingMode === 'external_api' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    URL da API de Frete (HTTPS)
                  </label>
                  <input
                    type="url"
                    value={configDraft.shippingApiEndpoint}
                    onChange={(e) =>
                      setConfigDraft((c) => ({ ...c, shippingApiEndpoint: e.target.value }))
                    }
                    placeholder="https://sua-api.com/frete"
                    className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer min-h-[44px]"
              >
                Salvar configurações
              </button>
            </div>
          </form>
        )}

        {/* TAB 5: EQUIPE ADMIN */}
        {activeTab === 'equipe' && user.email === PRIMARY_OWNER_EMAIL && (
          <div className="bg-white border border-stone-200 p-4 sm:p-8 space-y-6 max-w-2xl">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-extrabold">
                Administradores Autorizados
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">
                O proprietário principal ({PRIMARY_OWNER_EMAIL}) tem acesso permanente. Você pode
                autorizar outros membros informando o UID do Firebase Auth e o e-mail.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newAdminUid.trim() || !newAdminEmail.trim()) return;
                await addAdminUser(newAdminUid, newAdminEmail);
                setNewAdminUid('');
                setNewAdminEmail('');
                await loadAdminCollections();
                notify('Administrador adicionado.');
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <input
                type="text"
                required
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                placeholder="UID do usuário"
                className="px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
              />
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="E-mail Google"
                className="px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase cursor-pointer min-h-[44px]"
              >
                Autorizar Admin
              </button>
            </form>

            <div className="divide-y divide-stone-100">
              {admins.map((adm) => (
                <div key={adm.id} className="py-3 flex items-center justify-between text-sm">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold truncate">{adm.email}</p>
                    <p className="font-mono-num text-xs text-stone-500 truncate">UID: {adm.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await removeAdminUser(adm.id);
                      await loadAdminCollections();
                      notify('Administrador removido.');
                    }}
                    className="text-xs font-semibold text-[#C8102E] hover:underline cursor-pointer shrink-0"
                  >
                    Revogar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Quick Stock Modal (Adicionar / Modificar Estoque) */}
        {stockModalProduct && (
          <div
            className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
            onClick={() => setStockModalProduct(null)}
          >
            <form
              onSubmit={handleSaveQuickStock}
              onClick={(e) => e.stopPropagation()}
              className="bg-white border border-[#111111] w-full max-w-2xl p-4 sm:p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#C8102E]">
                    Gerenciar Estoque
                  </p>
                  <h3 className="font-display text-lg font-extrabold text-[#111111]">
                    {stockModalProduct.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setStockModalProduct(null)}
                  className="p-2 text-stone-500 hover:text-[#111111] cursor-pointer"
                  aria-label="Fechar modal de estoque"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAFAFA] border border-stone-200 p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, number> = {};
                      ALL_STANDARD_SIZES.forEach((s) => {
                        next[s] = stockDraftSizes[s] ?? 1;
                      });
                      setStockDraftSizes(next);
                    }}
                    className="px-3 py-1.5 border border-stone-300 bg-white text-xs font-semibold hover:border-[#111111] cursor-pointer"
                  >
                    Grade 34–44
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, number> = {};
                      KIDS_SIZES.forEach((s) => {
                        next[s] = stockDraftSizes[s] ?? 1;
                      });
                      setStockDraftSizes(next);
                    }}
                    className="px-3 py-1.5 border border-stone-300 bg-white text-xs font-semibold hover:border-[#111111] cursor-pointer"
                  >
                    Infantil 26–33
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <input
                    type="number"
                    min="0"
                    value={stockModalBulkQty}
                    onChange={(e) =>
                      setStockModalBulkQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                    }
                    className="font-mono-num w-14 px-2 py-1 border border-stone-300 text-center bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, number> = {};
                      Object.keys(stockDraftSizes).forEach((s) => {
                        next[s] = stockModalBulkQty;
                      });
                      setStockDraftSizes(next);
                    }}
                    className="px-2.5 py-1.5 bg-[#111111] text-white font-bold uppercase cursor-pointer"
                  >
                    Aplicar a todos
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                {Object.entries(stockDraftSizes)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([size, qty]) => (
                    <div
                      key={size}
                      className={`p-2.5 border ${
                        qty > 0 ? 'border-[#111111] bg-white' : 'border-stone-200 bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono-num text-xs font-bold">Tam. {size}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const copy = { ...stockDraftSizes };
                            delete copy[size];
                            setStockDraftSizes(copy);
                          }}
                          className="text-xs text-stone-400 hover:text-[#C8102E] cursor-pointer"
                          title="Remover tamanho"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setStockDraftSizes((prev) => ({
                              ...prev,
                              [size]: Math.max(0, qty - 1),
                            }))
                          }
                          className="p-2 border border-stone-300 hover:border-[#111111] cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) => {
                            const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                            setStockDraftSizes((prev) => ({ ...prev, [size]: val }));
                          }}
                          className="font-mono-num w-full text-center py-1.5 border border-stone-300 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setStockDraftSizes((prev) => ({
                              ...prev,
                              [size]: qty + 1,
                            }))
                          }
                          className="p-2 border border-stone-300 hover:border-[#111111] cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={stockModalCustomSize}
                  onChange={(e) => setStockModalCustomSize(e.target.value)}
                  placeholder="Adicionar outro tamanho (ex: 45)"
                  className="font-mono-num flex-1 px-3 py-2 border border-stone-300 text-xs min-h-[40px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    const s = stockModalCustomSize.trim();
                    if (!s) return;
                    setStockDraftSizes((prev) => ({ ...prev, [s]: prev[s] ?? 1 }));
                    setStockModalCustomSize('');
                  }}
                  className="px-4 py-2 bg-stone-800 text-white text-xs font-bold uppercase cursor-pointer min-h-[40px]"
                >
                  + Adicionar Tam.
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                <span className="font-mono-num text-xs text-stone-600">
                  Total:{' '}
                  <strong>
                    {Object.values(stockDraftSizes).reduce((acc, n) => acc + n, 0)}
                  </strong>{' '}
                  pares disponíveis
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStockModalProduct(null)}
                    className="px-4 py-2.5 border border-stone-300 text-xs font-bold uppercase cursor-pointer min-h-[42px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingStockModal}
                    className="px-5 py-2.5 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider cursor-pointer min-h-[42px] disabled:opacity-50"
                  >
                    {savingStockModal ? 'Salvando...' : 'Salvar Estoque'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

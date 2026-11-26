import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ShoppingBag } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AdminDashboard } from './components/AdminDashboard';
import { BrandCircles } from './components/BrandCircles';
import { BrandsDirectoryPage } from './components/BrandsDirectoryPage';
import { CartDrawer } from './components/CartDrawer';
import { CatalogSection, type CatalogPageHeader } from './components/CatalogSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header, type NavSectionKey } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { InstagramSection } from './components/InstagramSection';
import { ProductDetailPage } from './components/ProductDetailPage';
import { OfflineIndicator } from './components/PWAInstallButton';
import { auth } from './lib/firebase';
import {
  buildRoutePath,
  CATEGORY_ROUTE_META,
  getBrandSlug,
  getFiltersForCategoryKey,
  getRouteDocumentTitle,
  parseAppRoute,
  type AppRoute,
} from './lib/routes';
import { DEFAULT_STORE_CONFIG, INITIAL_BRANDS } from './lib/seedData';
import {
  checkIsUserAdmin,
  fetchBrands,
  fetchProducts,
  fetchStoreConfig,
} from './lib/storeService';
import { slugify } from './lib/utils';
import type { Brand, CartItem, Product, ProductFilters, StoreConfig } from './types';

const CART_STORAGE_KEY = 'samuka_tenis_cart_v1';
const FAVORITES_STORAGE_KEY = 'samuka_tenis_favorites_v1';

const DEFAULT_FILTERS: ProductFilters = {
  search: '',
  brandId: 'todos',
  gender: 'todos',
  type: 'todos',
  size: 'todos',
  color: 'todas',
  occasion: 'todas',
  minPrice: '',
  maxPrice: '',
  onlyPromo: false,
  onlyInStock: false,
  vitrine: 'todos',
};

export function App() {
  const [locationState, setLocationState] = useState<{ pathname: string; search: string }>(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));

  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Storefront Data from Firestore
  const [storeConfig, setStoreConfig] = useState<StoreConfig>(DEFAULT_STORE_CONFIG);
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Customer Navigation & Filtering
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [onlyFavoritesMode, setOnlyFavoritesMode] = useState(false);
  const preserveSearchOnNextRouteRef = useRef(false);

  // Persistent Cart & Favorites
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore quota errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore quota errors
    }
  }, [favorites]);

  useEffect(() => {
    const onPopState = () => {
      setLocationState({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const allowed = await checkIsUserAdmin(currentUser.uid, currentUser.email);
        setIsAdmin(allowed);
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loadStorefront = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [cfg, brandList, prodRes] = await Promise.all([
        fetchStoreConfig(),
        fetchBrands(false),
        fetchProducts(false),
      ]);
      setStoreConfig(cfg);
      setBrands(brandList);
      setProducts(prodRes.products);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void loadStorefront();
  }, [loadStorefront]);

  const route = useMemo(
    () =>
      parseAppRoute(
        locationState.pathname,
        locationState.search,
        brands,
        products,
        !loadingCatalog
      ),
    [locationState.pathname, locationState.search, brands, products, loadingCatalog]
  );

  // Upgrade legacy /?produto=<slug> query URLs into canonical /tenis/<slug>
  useEffect(() => {
    const params = new URLSearchParams(locationState.search);
    const legacySlug = params.get('produto');
    if (legacySlug && locationState.pathname === '/') {
      const nextPath = buildRoutePath({ kind: 'product', slug: legacySlug });
      window.history.replaceState({}, '', nextPath);
      setLocationState({ pathname: nextPath, search: '' });
    }
  }, [locationState.pathname, locationState.search]);

  const navigateToRoute = useCallback(
    (
      target: AppRoute,
      options?: { replace?: boolean; preserveSearch?: boolean; scrollTop?: boolean }
    ) => {
      const nextPath = buildRoutePath(target);
      preserveSearchOnNextRouteRef.current = Boolean(options?.preserveSearch);

      const currentFull = `${window.location.pathname}${window.location.search}`;
      if (currentFull !== nextPath) {
        if (options?.replace) {
          window.history.replaceState({}, '', nextPath);
        } else {
          window.history.pushState({}, '', nextPath);
        }
        setLocationState({ pathname: nextPath, search: '' });
      }

      if (options?.scrollTop !== false) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  // Synchronize filter state whenever URL route changes
  useEffect(() => {
    const keepSearch = preserveSearchOnNextRouteRef.current;
    preserveSearchOnNextRouteRef.current = false;

    if (route.kind === 'home') {
      setOnlyFavoritesMode(false);
      setFilters((prev) => ({
        ...DEFAULT_FILTERS,
        search: keepSearch ? prev.search : '',
      }));
      return;
    }

    if (route.kind === 'brand') {
      const matched = brands.find((b) => getBrandSlug(b) === route.brandSlug);
      setOnlyFavoritesMode(false);
      setFilters((prev) => ({
        ...DEFAULT_FILTERS,
        brandId: matched?.id || route.brandSlug,
        search: keepSearch ? prev.search : '',
      }));
      return;
    }

    if (route.kind === 'category') {
      const { filters: nextFilters, onlyFavorites } = getFiltersForCategoryKey(
        route.categoryKey,
        DEFAULT_FILTERS
      );
      setOnlyFavoritesMode(onlyFavorites);
      setFilters((prev) => ({
        ...nextFilters,
        search: keepSearch ? prev.search : '',
      }));
    }
  }, [route, brands]);

  const activeProduct = useMemo(() => {
    if (route.kind !== 'product') return null;
    const targetSlug = slugify(route.slug);
    return (
      products.find(
        (p) =>
          p.slug === route.slug ||
          p.id === route.slug ||
          slugify(p.slug || p.name) === targetSlug
      ) || null
    );
  }, [route, products]);

  const activeBrand = useMemo(() => {
    if (route.kind !== 'brand') return null;
    return brands.find((b) => getBrandSlug(b) === route.brandSlug) || null;
  }, [route, brands]);

  // Keep browser document.title updated per route
  useEffect(() => {
    document.title = getRouteDocumentTitle(
      route,
      storeConfig.storeName,
      brands,
      activeProduct
    );
  }, [route, storeConfig.storeName, brands, activeProduct]);

  const activeNav: NavSectionKey = useMemo(() => {
    if (route.kind === 'home') return 'inicio';
    if (route.kind === 'brands' || route.kind === 'brand') return 'marcas';
    if (route.kind === 'category') {
      if (route.categoryKey === 'masculino') return 'masculino';
      if (route.categoryKey === 'feminino') return 'feminino';
      if (route.categoryKey === 'infantil') return 'infantil';
      if (route.categoryKey === 'ofertas') return 'ofertas';
      if (route.categoryKey === 'favoritos') return 'favoritos';
      return 'todos';
    }
    if (route.kind === 'product') return 'todos';
    return 'inicio';
  }, [route]);

  const handleHeaderNavigate = (section: NavSectionKey) => {
    if (section === 'inicio') {
      navigateToRoute({ kind: 'home' });
    } else if (section === 'marcas') {
      navigateToRoute({ kind: 'brands' });
    } else if (section === 'masculino') {
      navigateToRoute({ kind: 'category', categoryKey: 'masculino' });
    } else if (section === 'feminino') {
      navigateToRoute({ kind: 'category', categoryKey: 'feminino' });
    } else if (section === 'infantil') {
      navigateToRoute({ kind: 'category', categoryKey: 'infantil' });
    } else if (section === 'ofertas') {
      navigateToRoute({ kind: 'category', categoryKey: 'ofertas' });
    } else if (section === 'favoritos') {
      navigateToRoute({ kind: 'category', categoryKey: 'favoritos' });
    } else {
      navigateToRoute({ kind: 'category', categoryKey: 'todos' });
    }
  };

  const handleSelectBrand = (brandId: string) => {
    if (brandId === 'todos') {
      navigateToRoute({ kind: 'category', categoryKey: 'todos' });
      return;
    }
    const found = brands.find((b) => b.id === brandId);
    const brandSlug = found ? getBrandSlug(found) : slugify(brandId);
    navigateToRoute({ kind: 'brand', brandSlug });
  };

  const handleOpenFavorites = () => {
    if (route.kind === 'category' && route.categoryKey === 'favoritos') {
      navigateToRoute({ kind: 'category', categoryKey: 'todos' });
    } else {
      navigateToRoute({ kind: 'category', categoryKey: 'favoritos' });
    }
  };

  const handleSearchChange = (val: string) => {
    setFilters((p) => ({ ...p, search: val }));
    const isCatalogView =
      route.kind === 'home' || route.kind === 'category' || route.kind === 'brand';
    if (val.trim().length > 0 && !isCatalogView) {
      navigateToRoute({ kind: 'category', categoryKey: 'todos' }, { preserveSearch: true });
    } else if (val.trim().length > 0 && route.kind === 'home') {
      const el = document.getElementById('secao-catalogo');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleToggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectProduct = (product: Product) => {
    navigateToRoute({ kind: 'product', slug: product.slug || product.id });
  };

  // Non-blocking add: keeps user browsing so they can add multiple sneakers before finalizing
  const handleAddToCart = (product: Product, size: string, color: string) => {
    const hasPromo =
      product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
    const unitPrice = hasPromo ? product.promoPrice : product.price;
    const key = `${product.id}__${size}__${color}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.key === key);
      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          brandName: product.brandName,
          image: product.images?.[0] || '',
          size,
          color,
          unitPrice,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const catalogPageHeader: CatalogPageHeader | undefined = useMemo(() => {
    if (route.kind === 'brand') {
      const brandName = activeBrand?.name || route.brandSlug.toUpperCase();
      return {
        breadcrumbLabel: brandName,
        eyebrow: `Coleção Exclusiva · ${brandName}`,
        title: `TÊNIS ${brandName.toUpperCase()}`,
        subtitle: `Explore todos os modelos ${brandName} disponíveis com numeração e estoque atualizados.`,
      };
    }
    if (route.kind === 'category') {
      const meta = CATEGORY_ROUTE_META[route.categoryKey];
      return {
        breadcrumbLabel: meta.title,
        eyebrow: meta.eyebrow,
        title: meta.title,
        subtitle: meta.description,
      };
    }
    return undefined;
  }, [route, activeBrand]);

  if (route.kind === 'admin') {
    return (
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <AdminDashboard
            user={user}
            isAdmin={isAdmin}
            authLoading={authLoading}
            storeConfig={storeConfig}
            initialTab={route.tab}
            onTabChange={(tab) => navigateToRoute({ kind: 'admin', tab }, { scrollTop: false })}
            onRefreshStorefront={loadStorefront}
            onBackToStore={() => navigateToRoute({ kind: 'home' })}
          />
        </ErrorBoundary>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <div className="min-h-screen flex flex-col bg-white text-[#111111]">
          <Header
            storeConfig={storeConfig}
            activeNav={activeNav}
            onNavigate={handleHeaderNavigate}
            searchQuery={filters.search}
            onSearchChange={handleSearchChange}
            favoritesCount={favorites.length}
            cartCount={cartCount}
            onOpenCart={() => setCartOpen(true)}
            onOpenFavorites={handleOpenFavorites}
          />

          <main className="flex-1">
            {route.kind === 'home' && (
              <>
                <HeroBanner
                  storeConfig={storeConfig}
                  onExplore={() => navigateToRoute({ kind: 'category', categoryKey: 'todos' })}
                />

                <BrandCircles
                  brands={brands}
                  selectedBrandId={filters.brandId}
                  onSelectBrand={handleSelectBrand}
                />

                <CatalogSection
                  products={products}
                  brands={brands}
                  storeName={storeConfig.storeName}
                  filters={filters}
                  onUpdateFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
                  onResetFilters={() => setFilters(DEFAULT_FILTERS)}
                  favorites={favorites}
                  onlyFavoritesMode={onlyFavoritesMode}
                  onToggleOnlyFavoritesMode={setOnlyFavoritesMode}
                  onToggleFavorite={handleToggleFavorite}
                  onSelectProduct={handleSelectProduct}
                  onNavigateRoute={(r) => navigateToRoute(r)}
                  isLoading={loadingCatalog}
                />

                <InstagramSection
                  storeConfig={storeConfig}
                  products={products}
                  onSelectProduct={handleSelectProduct}
                />
              </>
            )}

            {route.kind === 'brands' && (
              <BrandsDirectoryPage
                brands={brands}
                products={products}
                onNavigateRoute={(r) => navigateToRoute(r)}
              />
            )}

            {(route.kind === 'brand' || route.kind === 'category') && (
              <>
                <CatalogSection
                  products={products}
                  brands={brands}
                  storeName={storeConfig.storeName}
                  filters={filters}
                  onUpdateFilters={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
                  onResetFilters={() => navigateToRoute({ kind: 'category', categoryKey: 'todos' })}
                  favorites={favorites}
                  onlyFavoritesMode={onlyFavoritesMode}
                  onToggleOnlyFavoritesMode={(val) => {
                    if (val) {
                      navigateToRoute({ kind: 'category', categoryKey: 'favoritos' });
                    } else {
                      navigateToRoute({ kind: 'category', categoryKey: 'todos' });
                    }
                  }}
                  onToggleFavorite={handleToggleFavorite}
                  onSelectProduct={handleSelectProduct}
                  onNavigateRoute={(r) => navigateToRoute(r)}
                  pageHeader={catalogPageHeader}
                  isLoading={loadingCatalog}
                />

                <BrandCircles
                  brands={brands}
                  selectedBrandId={filters.brandId}
                  onSelectBrand={handleSelectBrand}
                />
              </>
            )}

            {route.kind === 'product' && (
              <ProductDetailPage
                product={activeProduct}
                allProducts={products}
                brands={brands}
                storeName={storeConfig.storeName}
                isLoading={loadingCatalog}
                favorites={favorites}
                cartCount={cartCount}
                onNavigateRoute={(r) => navigateToRoute(r)}
                onToggleFavorite={handleToggleFavorite}
                onAddToCart={handleAddToCart}
                onOpenCart={() => setCartOpen(true)}
              />
            )}

            {route.kind === 'resolving' && (
              <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-14">
                <div className="h-8 w-64 bg-stone-200 animate-pulse mb-6" />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="border border-stone-200 bg-[#F5F5F4] animate-pulse aspect-[3/4]"
                    />
                  ))}
                </div>
              </section>
            )}

            {route.kind === 'not-found' && (
              <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
                <div className="max-w-xl mx-auto border border-stone-200 bg-[#FAFAFA] p-8 sm:p-10 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-2">
                    Página não encontrada
                  </p>
                  <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111111] mb-3">
                    Não encontramos o endereço solicitado
                  </h1>
                  <p className="text-sm text-stone-600 mb-7 leading-relaxed">
                    Verifique o link ou escolha uma das opções abaixo para navegar pelo catálogo da{' '}
                    {storeConfig.storeName || 'Samuka Tênis'}.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                      href="/"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        navigateToRoute({ kind: 'home' });
                      }}
                      className="w-full sm:w-auto px-6 py-3.5 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Ir para o Início
                    </a>
                    <a
                      href="/todos"
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        navigateToRoute({ kind: 'category', categoryKey: 'todos' });
                      }}
                      className="w-full sm:w-auto px-6 py-3.5 border border-stone-300 hover:border-[#111111] bg-white text-[#111111] text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Ver todos os tênis
                    </a>
                  </div>
                </div>
              </section>
            )}
          </main>

          <Footer
            storeConfig={storeConfig}
            brands={brands}
            onNavigate={handleHeaderNavigate}
            onSelectBrand={handleSelectBrand}
            onNavigateRoute={(r) => navigateToRoute(r)}
            onOpenAdmin={() => navigateToRoute({ kind: 'admin', tab: 'produtos' })}
          />

          <CartDrawer
            isOpen={cartOpen}
            onClose={() => setCartOpen(false)}
            items={cart}
            storeConfig={storeConfig}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={() => setCart([])}
          />

          {/* Floating Checkout CTA when cart has items */}
          <AnimatePresence>
            {cartCount > 0 && !cartOpen && (
              <motion.button
                key="floating-checkout-btn"
                type="button"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ duration: 0.22 }}
                onClick={() => setCartOpen(true)}
                className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2.5 px-5 py-3 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider shadow-xl transition-colors cursor-pointer min-h-[46px]"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Finalizar Pedido ({cartCount})</span>
              </motion.button>
            )}
          </AnimatePresence>

          <OfflineIndicator />
        </div>
      </ErrorBoundary>
    </MotionConfig>
  );
}

export default App;

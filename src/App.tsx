import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ShoppingBag } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { AdminDashboard } from './components/AdminDashboard';
import { BrandCircles } from './components/BrandCircles';
import { CartDrawer } from './components/CartDrawer';
import { CatalogSection } from './components/CatalogSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header, type NavSectionKey } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { ProductDetailModal } from './components/ProductDetailModal';
import { auth } from './lib/firebase';
import { DEFAULT_STORE_CONFIG, INITIAL_BRANDS } from './lib/seedData';
import {
  checkIsUserAdmin,
  fetchBrands,
  fetchProducts,
  fetchStoreConfig,
} from './lib/storeService';
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

function readInitialRoute(): 'store' | 'admin' {
  return window.location.pathname.startsWith('/admin') ? 'admin' : 'store';
}

export function App() {
  const [route, setRoute] = useState<'store' | 'admin'>(readInitialRoute);

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
  const [activeNav, setActiveNav] = useState<NavSectionKey>('inicio');
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [onlyFavoritesMode, setOnlyFavoritesMode] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
      setRoute(readInitialRoute());
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

      const params = new URLSearchParams(window.location.search);
      const productSlug = params.get('produto');
      if (productSlug) {
        const found = prodRes.products.find(
          (p) => p.slug === productSlug || p.id === productSlug
        );
        if (found) setSelectedProduct(found);
      }
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void loadStorefront();
  }, [loadStorefront]);

  const navigateToRoute = (target: 'store' | 'admin') => {
    setRoute(target);
    const nextPath = target === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleHeaderNavigate = (section: NavSectionKey) => {
    setActiveNav(section);
    setOnlyFavoritesMode(false);

    if (section === 'inicio') {
      setFilters(DEFAULT_FILTERS);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (section === 'marcas') {
      scrollToSection('secao-marcas');
      return;
    }

    if (section === 'todos') {
      setFilters(DEFAULT_FILTERS);
    } else if (section === 'masculino') {
      setFilters({ ...DEFAULT_FILTERS, gender: 'masculino' });
    } else if (section === 'feminino') {
      setFilters({ ...DEFAULT_FILTERS, gender: 'feminino' });
    } else if (section === 'infantil') {
      setFilters({ ...DEFAULT_FILTERS, gender: 'infantil' });
    } else if (section === 'ofertas') {
      setFilters({ ...DEFAULT_FILTERS, vitrine: 'ofertas', onlyPromo: true });
    }

    setTimeout(() => scrollToSection('secao-catalogo'), 40);
  };

  const handleSelectBrand = (brandId: string) => {
    setOnlyFavoritesMode(false);
    setActiveNav('todos');
    setFilters((prev) => ({
      ...prev,
      brandId,
      vitrine: 'todos',
    }));
    setTimeout(() => scrollToSection('secao-catalogo'), 40);
  };

  const handleOpenFavorites = () => {
    setOnlyFavoritesMode((prev) => {
      const next = !prev;
      if (next) {
        setActiveNav('favoritos');
        setTimeout(() => scrollToSection('secao-catalogo'), 40);
      } else {
        setActiveNav('todos');
      }
      return next;
    });
  };

  const handleToggleFavorite = (productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    const url = new URL(window.location.href);
    url.searchParams.set('produto', product.slug || product.id);
    window.history.replaceState({}, '', url.toString());
  };

  const handleCloseProductModal = () => {
    setSelectedProduct(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('produto');
    window.history.replaceState({}, '', url.toString());
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

  if (route === 'admin') {
    return (
      <MotionConfig reducedMotion="user">
        <ErrorBoundary>
          <AdminDashboard
            user={user}
            isAdmin={isAdmin}
            authLoading={authLoading}
            storeConfig={storeConfig}
            onRefreshStorefront={loadStorefront}
            onBackToStore={() => navigateToRoute('store')}
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
            onSearchChange={(val) => setFilters((p) => ({ ...p, search: val }))}
            favoritesCount={favorites.length}
            cartCount={cartCount}
            onOpenCart={() => setCartOpen(true)}
            onOpenFavorites={handleOpenFavorites}
          />

          <main className="flex-1">
            <HeroBanner
              storeConfig={storeConfig}
              onExplore={() => {
                setActiveNav('todos');
                scrollToSection('secao-catalogo');
              }}
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
              onResetFilters={() => {
                setActiveNav('todos');
                setFilters(DEFAULT_FILTERS);
              }}
              favorites={favorites}
              onlyFavoritesMode={onlyFavoritesMode}
              onToggleOnlyFavoritesMode={setOnlyFavoritesMode}
              onToggleFavorite={handleToggleFavorite}
              onSelectProduct={handleSelectProduct}
              isLoading={loadingCatalog}
            />
          </main>

          <Footer
            storeConfig={storeConfig}
            brands={brands}
            onNavigate={handleHeaderNavigate}
            onSelectBrand={handleSelectBrand}
            onOpenAdmin={() => navigateToRoute('admin')}
          />

          <ProductDetailModal
            product={selectedProduct}
            storeName={storeConfig.storeName}
            isFavorite={selectedProduct ? favorites.includes(selectedProduct.id) : false}
            cartCount={cartCount}
            onClose={handleCloseProductModal}
            onToggleFavorite={handleToggleFavorite}
            onAddToCart={handleAddToCart}
            onOpenCart={() => setCartOpen(true)}
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
            {cartCount > 0 && !cartOpen && !selectedProduct && (
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
        </div>
      </ErrorBoundary>
    </MotionConfig>
  );
}

export default App;

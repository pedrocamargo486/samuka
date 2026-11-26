import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppUrl,
  calculateShippingQuote,
  formatBRL,
  formatCepInput,
  lookupCep,
} from '../lib/utils';
import { createCustomerOrder } from '../lib/storeService';
import type {
  CartItem,
  CustomerOrderInfo,
  ShippingQuote,
  StoreConfig,
} from '../types';
import { SmartImage } from './SmartImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  storeConfig: StoreConfig;
  onUpdateQuantity: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const EMPTY_CUSTOMER: CustomerOrderInfo = {
  name: '',
  phone: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
};

const INITIAL_QUOTE: ShippingQuote = {
  status: 'idle',
  price: null,
  estimatedDays: '',
  modality: '',
  message: '',
};

export function CartDrawer({
  isOpen,
  onClose,
  items,
  storeConfig,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartDrawerProps) {
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [customer, setCustomer] = useState<CustomerOrderInfo>(EMPTY_CUSTOMER);
  const [shippingQuote, setShippingQuote] = useState<ShippingQuote>(INITIAL_QUOTE);
  const [cepSearching, setCepSearching] = useState(false);
  const [formError, setFormError] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [copied, setCopied] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  useEffect(() => {
    setGeneratedMessage('');
    setOrderNumber('');
  }, [items, deliveryMethod, customer, shippingQuote]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleCalculateShipping = async () => {
    setFormError('');
    const cleanCep = customer.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setShippingQuote({
        status: 'error',
        price: null,
        estimatedDays: '',
        modality: '',
        message: 'Informe um CEP válido com 8 dígitos.',
      });
      return;
    }

    setCepSearching(true);
    setShippingQuote({
      status: 'loading',
      price: null,
      estimatedDays: '',
      modality: '',
      message: 'Consultando CEP e calculando opções de entrega...',
    });

    try {
      const addressData = await lookupCep(cleanCep);
      if (addressData) {
        setCustomer((prev) => ({
          ...prev,
          street: addressData.street || prev.street,
          neighborhood: addressData.neighborhood || prev.neighborhood,
          city: addressData.city || prev.city,
          state: addressData.state || prev.state,
        }));
      }
      const quote = await calculateShippingQuote(cleanCep, storeConfig, subtotal, addressData);
      setShippingQuote(quote);
    } catch {
      const quote = await calculateShippingQuote(cleanCep, storeConfig, subtotal, null);
      setShippingQuote(quote);
    } finally {
      setCepSearching(false);
    }
  };

  const handleGenerateOrder = async () => {
    setFormError('');
    if (items.length === 0) {
      setFormError('Adicione pelo menos um tênis ao carrinho.');
      return;
    }
    if (!customer.name.trim()) {
      setFormError('Informe seu nome para identificar o pedido.');
      return;
    }
    if (!customer.phone.trim()) {
      setFormError('Informe seu telefone ou WhatsApp para contato.');
      return;
    }
    if (deliveryMethod === 'delivery') {
      const cleanCep = customer.cep.replace(/\D/g, '');
      if (cleanCep.length !== 8) {
        setFormError('Informe um CEP válido para entrega.');
        return;
      }
      if (!customer.street.trim() || !customer.number.trim()) {
        setFormError('Informe a rua e o número do endereço de entrega.');
        return;
      }
    }

    const shippingCostValue =
      deliveryMethod === 'delivery' &&
      shippingQuote.status === 'calculated' &&
      shippingQuote.price !== null
        ? shippingQuote.price
        : 0;
    const totalValue = subtotal + shippingCostValue;
    const formattedAddress =
      deliveryMethod === 'delivery'
        ? [
            customer.street,
            customer.number ? `nº ${customer.number}` : '',
            customer.complement,
            customer.neighborhood,
            customer.city && customer.state ? `${customer.city}/${customer.state}` : customer.city,
          ]
            .filter(Boolean)
            .join(', ')
        : storeConfig.storeAddress || 'Retirada na loja';

    setSavingOrder(true);
    let resolvedOrderNumber = `SAM-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    try {
      const created = await createCustomerOrder({
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        deliveryMethod,
        customerCep: deliveryMethod === 'delivery' ? customer.cep.trim() : '',
        customerAddress: formattedAddress,
        subtotal,
        shippingCost: shippingCostValue,
        total: totalValue,
        items,
      });
      resolvedOrderNumber = created.orderNumber;
    } catch {
      // Offline / transient Firestore errors never block customer WhatsApp checkout
    } finally {
      setSavingOrder(false);
    }

    const msg = buildWhatsAppOrderMessage({
      orderNumber: resolvedOrderNumber,
      storeName: storeConfig.storeName || 'Samuka Tênis',
      items,
      subtotal,
      deliveryMethod,
      shippingQuote,
      pickupFree: storeConfig.pickupFree,
      customer,
    });
    setOrderNumber(resolvedOrderNumber);
    setGeneratedMessage(msg);
  };

  const whatsappUrl = generatedMessage
    ? buildWhatsAppUrl(storeConfig.whatsappNumber, generatedMessage)
    : '';

  const shippingCostDisplay =
    deliveryMethod === 'pickup'
      ? storeConfig.pickupFree
        ? 'Grátis'
        : 'A confirmar'
      : shippingQuote.status === 'calculated' && shippingQuote.price !== null
        ? `${formatBRL(shippingQuote.price)} (estimado)`
        : 'A calcular / confirmar';

  const totalPreview =
    subtotal +
    (deliveryMethod === 'delivery' &&
    shippingQuote.status === 'calculated' &&
    shippingQuote.price !== null
      ? shippingQuote.price
      : 0);

  const handleCopyMessage = async () => {
    if (!generatedMessage) return;
    try {
      await navigator.clipboard.writeText(generatedMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="cart-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Carrinho de compras"
          onClick={onClose}
        >
          <motion.div
            key="cart-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-[#111111]" />
                <h2 className="font-display text-lg font-extrabold tracking-tight text-[#111111]">
                  SEU CARRINHO
                </h2>
                <span className="font-mono-num text-xs text-stone-500">
                  ({items.reduce((acc, i) => acc + i.quantity, 0)})
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-stone-500 hover:text-[#111111] cursor-pointer"
                aria-label="Fechar carrinho"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                  <p className="font-display text-base font-bold text-[#111111] mb-1">
                    Seu carrinho está vazio
                  </p>
                  <p className="text-sm text-stone-500 mb-6">
                    Escolha um modelo no catálogo e selecione sua numeração para começar.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Explorar tênis
                  </button>
                </div>
              ) : (
                <>
                  {/* Item List */}
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.key}
                        className="flex gap-3.5 pb-4 border-b border-stone-100"
                      >
                        <div className="w-20 h-20 bg-[#F5F5F4] shrink-0 overflow-hidden">
                          <SmartImage
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] uppercase tracking-wider text-stone-500">
                            {item.brandName}
                          </p>
                          <h3 className="font-display text-sm font-bold text-[#111111] truncate">
                            {item.name}
                          </h3>
                          <p className="font-mono-num text-xs text-stone-600 mt-0.5">
                            Tam: {item.size}
                            {item.color ? ` · ${item.color}` : ''}
                          </p>

                          <div className="flex items-center justify-between mt-3">
                            <div className="inline-flex items-center border border-stone-300">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.key, -1)}
                                className="p-1.5 text-[#111111] hover:bg-stone-100 cursor-pointer"
                                aria-label="Diminuir quantidade"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-mono-num px-3 text-xs font-semibold text-[#111111]">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(item.key, 1)}
                                className="p-1.5 text-[#111111] hover:bg-stone-100 cursor-pointer"
                                aria-label="Aumentar quantidade"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-mono-num text-sm font-bold text-[#111111]">
                                {formatBRL(item.unitPrice * item.quantity)}
                              </span>
                              <button
                                type="button"
                                onClick={() => onRemoveItem(item.key)}
                                className="p-1 text-stone-400 hover:text-[#C8102E] cursor-pointer"
                                aria-label="Remover produto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delivery vs Pickup Selection */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                      Forma de recebimento
                    </h3>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('delivery')}
                        className={`p-3 border text-left transition-colors cursor-pointer ${
                          deliveryMethod === 'delivery'
                            ? 'border-[#111111] bg-[#111111] text-white'
                            : 'border-stone-300 bg-white text-[#111111] hover:border-[#111111]'
                        }`}
                      >
                        <Truck className="w-4 h-4 mb-1.5" />
                        <p className="text-xs font-bold uppercase tracking-wide">
                          Receber em casa
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryMethod('pickup')}
                        className={`p-3 border text-left transition-colors cursor-pointer ${
                          deliveryMethod === 'pickup'
                            ? 'border-[#111111] bg-[#111111] text-white'
                            : 'border-stone-300 bg-white text-[#111111] hover:border-[#111111]'
                        }`}
                      >
                        <Store className="w-4 h-4 mb-1.5" />
                        <p className="text-xs font-bold uppercase tracking-wide">
                          Retirar na loja
                        </p>
                      </button>
                    </div>

                    {/* Option 1: Delivery & CEP Lookup */}
                    {deliveryMethod === 'delivery' ? (
                      <div className="bg-[#FAFAFA] border border-stone-200 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#111111]">
                            Calcular o frete pelo CEP
                          </label>
                          <span className="text-[10px] font-medium text-stone-500">
                            Pode sofrer alterações
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={customer.cep}
                            onChange={(e) =>
                              setCustomer((prev) => ({
                                ...prev,
                                cep: formatCepInput(e.target.value),
                              }))
                            }
                            placeholder="00000-000"
                            maxLength={9}
                            className="font-mono-num flex-1 px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                          />
                          <button
                            type="button"
                            onClick={handleCalculateShipping}
                            disabled={cepSearching}
                            className="px-4 py-2.5 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#C8102E] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                          >
                            {cepSearching ? 'Calculando...' : 'Calcular frete'}
                          </button>
                        </div>

                        {shippingQuote.status !== 'idle' && (
                          <div
                            className={`p-3 text-xs border space-y-1.5 ${
                              shippingQuote.status === 'error'
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-white border-stone-200 text-stone-700'
                            }`}
                          >
                            {shippingQuote.modality && (
                              <div className="flex items-center justify-between font-bold text-[#111111]">
                                <span>{shippingQuote.modality}</span>
                                {shippingQuote.status === 'calculated' &&
                                  shippingQuote.price !== null && (
                                    <span className="font-mono-num">
                                      {shippingQuote.price === 0
                                        ? 'Grátis'
                                        : formatBRL(shippingQuote.price)}
                                    </span>
                                  )}
                              </div>
                            )}
                            {shippingQuote.estimatedDays && (
                              <p className="font-medium text-[#111111]">
                                Prazo estimado: {shippingQuote.estimatedDays}
                              </p>
                            )}
                            <p>{shippingQuote.message}</p>
                            {shippingQuote.status !== 'error' &&
                              shippingQuote.status !== 'loading' && (
                                <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 p-2">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span>
                                    Aviso: o valor do frete e o prazo podem sofrer alterações após
                                    conferência da loja pelo WhatsApp.
                                  </span>
                                </p>
                              )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Option 2: Store Pickup */
                      <div className="bg-[#FAFAFA] border border-stone-200 p-4 space-y-2 text-xs text-stone-700">
                        <div className="flex items-center justify-between font-bold text-[#111111]">
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" />
                            Retirada presencial
                          </span>
                          <span>{storeConfig.pickupFree ? 'Grátis' : 'Consulte na loja'}</span>
                        </div>
                        {storeConfig.storeAddress ? (
                          <p>
                            <strong>Endereço:</strong> {storeConfig.storeAddress}
                          </p>
                        ) : (
                          <p className="text-stone-500">
                            Endereço da loja será informado pelo atendimento no WhatsApp.
                          </p>
                        )}
                        {storeConfig.openingHours && (
                          <p>
                            <strong>Horário:</strong> {storeConfig.openingHours}
                          </p>
                        )}
                        {storeConfig.pickupInfo && <p>{storeConfig.pickupInfo}</p>}
                      </div>
                    )}
                  </div>

                  {/* Customer Details Form */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                      Seus dados para o pedido
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                          Nome completo *
                        </label>
                        <input
                          type="text"
                          value={customer.name}
                          onChange={(e) => setCustomer((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Seu nome"
                          className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                          Telefone / WhatsApp *
                        </label>
                        <input
                          type="tel"
                          value={customer.phone}
                          onChange={(e) => setCustomer((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="(00) 00000-0000"
                          className="font-mono-num w-full px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                        />
                      </div>
                    </div>

                    {deliveryMethod === 'delivery' && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              Rua / Avenida *
                            </label>
                            <input
                              type="text"
                              value={customer.street}
                              onChange={(e) =>
                                setCustomer((p) => ({ ...p, street: e.target.value }))
                              }
                              placeholder="Logradouro"
                              className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              Número *
                            </label>
                            <input
                              type="text"
                              value={customer.number}
                              onChange={(e) =>
                                setCustomer((p) => ({ ...p, number: e.target.value }))
                              }
                              placeholder="Nº"
                              className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              Bairro
                            </label>
                            <input
                              type="text"
                              value={customer.neighborhood}
                              onChange={(e) =>
                                setCustomer((p) => ({ ...p, neighborhood: e.target.value }))
                              }
                              placeholder="Bairro"
                              className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              Complemento
                            </label>
                            <input
                              type="text"
                              value={customer.complement}
                              onChange={(e) =>
                                setCustomer((p) => ({ ...p, complement: e.target.value }))
                              }
                              placeholder="Apto, bloco..."
                              className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              Cidade
                            </label>
                            <input
                              type="text"
                              value={customer.city}
                              onChange={(e) =>
                                setCustomer((p) => ({ ...p, city: e.target.value }))
                              }
                              placeholder="Cidade"
                              className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                              UF
                            </label>
                            <input
                              type="text"
                              maxLength={2}
                              value={customer.state}
                              onChange={(e) =>
                                setCustomer((p) => ({
                                  ...p,
                                  state: e.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="UF"
                              className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm uppercase focus:outline-none focus:border-[#111111]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-xs font-semibold text-[#C8102E]">
                      {formError}
                    </div>
                  )}

                  {/* Generated WhatsApp Order Confirmation Panel */}
                  {generatedMessage && (
                    <div className="border border-[#111111] bg-[#FAFAFA] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                            Pedido pronto para envio no WhatsApp
                          </p>
                          {orderNumber && (
                            <p className="font-mono-num text-[11px] font-bold text-[#C8102E] mt-0.5">
                              Código do pedido: #{orderNumber}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyMessage}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-[#111111] cursor-pointer"
                        >
                          {copied ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copied ? 'Copiado' : 'Copiar texto'}</span>
                        </button>
                      </div>

                      <pre className="text-xs text-stone-700 whitespace-pre-wrap font-sans bg-white border border-stone-200 p-3 max-h-44 overflow-y-auto">
                        {generatedMessage}
                      </pre>

                      {whatsappUrl ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3.5 px-4 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>ENVIAR PEDIDO NO WHATSAPP</span>
                        </a>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900">
                          O número de WhatsApp da loja ainda não foi configurado no Painel
                          Administrativo. Use o botão <strong>Copiar texto</strong> acima para
                          enviar o pedido manualmente.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onClearCart();
                          setGeneratedMessage('');
                        }}
                        className="w-full py-2 text-xs font-semibold text-stone-600 hover:text-[#111111] underline cursor-pointer"
                      >
                        Já enviei meu pedido — limpar carrinho
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sticky Footer Summary */}
            {items.length > 0 && (
              <div className="border-t border-stone-200 bg-white px-5 py-4 space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span className="font-mono-num">{formatBRL(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-stone-600">
                    <span>Frete / Retirada</span>
                    <span className="font-mono-num">{shippingCostDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-extrabold text-[#111111] pt-1 border-t border-stone-100">
                    <span>Total estimado</span>
                    <span className="font-mono-num">{formatBRL(totalPreview)}</span>
                  </div>
                </div>

                {!generatedMessage && (
                  <button
                    type="button"
                    disabled={savingOrder}
                    onClick={() => void handleGenerateOrder()}
                    className="w-full py-4 bg-[#111111] hover:bg-[#C8102E] text-white text-xs sm:text-sm font-bold uppercase tracking-[0.12em] transition-colors cursor-pointer disabled:opacity-60 min-h-[48px]"
                  >
                    {savingOrder ? 'GERANDO PEDIDO...' : 'FINALIZAR PEDIDO'}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

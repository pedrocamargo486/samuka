import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  Store,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  cancelOrder,
  confirmOrderAndDeductStock,
  deleteOrder,
} from '../lib/storeService';
import { formatBRL, normalizeWhatsAppDigits } from '../lib/utils';
import type { OrderRecord, OrderStatus, Product } from '../types';
import { SmartImage } from './SmartImage';

interface OrdersTabProps {
  orders: OrderRecord[];
  products: Product[];
  onRefreshAll: () => Promise<void>;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

type OrderFilter = 'pendente' | 'confirmado' | 'cancelado' | 'todos';

const PAYMENT_OPTIONS = ['Pix', 'Cartão Crédito', 'Cartão Débito', 'Dinheiro'];

function formatOrderTimestamp(ts: unknown): string {
  const seconds =
    typeof (ts as { seconds?: number } | undefined)?.seconds === 'number'
      ? (ts as { seconds: number }).seconds
      : null;
  if (!seconds) return 'Agora mesmo';
  const date = new Date(seconds * 1000);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: OrderStatus): {
  label: string;
  className: string;
} {
  if (status === 'confirmado') {
    return {
      label: 'Pago / Confirmado',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };
  }
  if (status === 'cancelado') {
    return {
      label: 'Cancelado',
      className: 'bg-red-50 text-[#C8102E] border-red-200',
    };
  }
  return {
    label: 'Aguardando pagamento',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  };
}

export function OrdersTab({
  orders,
  products,
  onRefreshAll,
  onNotify,
  onError,
}: OrdersTabProps) {
  const [statusFilter, setStatusFilter] = useState<OrderFilter>('pendente');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Per-order confirmation controls
  const [paymentByOrder, setPaymentByOrder] = useState<Record<string, string>>({});
  const [feeByOrder, setFeeByOrder] = useState<Record<string, string>>({});
  const [notesByOrder, setNotesByOrder] = useState<Record<string, string>>({});

  const summary = useMemo(() => {
    let pendingCount = 0;
    let confirmedCount = 0;
    let canceledCount = 0;
    let confirmedRevenue = 0;

    for (const o of orders) {
      if (o.status === 'pendente') pendingCount += 1;
      else if (o.status === 'confirmado') {
        confirmedCount += 1;
        confirmedRevenue += Number(o.total) || 0;
      } else if (o.status === 'cancelado') canceledCount += 1;
    }

    return {
      pendingCount,
      confirmedCount,
      canceledCount,
      confirmedRevenue,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'todos' && order.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const matchesMeta =
        order.orderNumber.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q) ||
        order.customerPhone.toLowerCase().includes(q) ||
        order.customerAddress.toLowerCase().includes(q);
      const matchesItem = order.items.some(
        (item) =>
          item.productName.toLowerCase().includes(q) ||
          item.brandName.toLowerCase().includes(q)
      );
      return matchesMeta || matchesItem;
    });
  }, [orders, statusFilter, searchTerm]);

  const handleConfirmOrder = async (order: OrderRecord) => {
    setProcessingId(order.id);
    onError('');
    try {
      const paymentMethod = paymentByOrder[order.id] || 'Pix';
      const extraFee = Math.max(0, Number(feeByOrder[order.id] || 0) || 0);
      const extraNotes = notesByOrder[order.id] || '';
      const result = await confirmOrderAndDeductStock({
        order,
        products,
        paymentMethod,
        extraFee,
        extraNotes,
      });
      await onRefreshAll();
      onNotify(
        `Pedido #${order.orderNumber} confirmado! ${result.deductedItems} par(es) baixado(s) do estoque e ${result.salesRecorded} venda(s) registrada(s) no lucro.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao confirmar pagamento do pedido.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelOrder = async (order: OrderRecord) => {
    setProcessingId(order.id);
    onError('');
    try {
      await cancelOrder(order.id, notesByOrder[order.id] || order.notes || 'Cancelado pela loja');
      await onRefreshAll();
      onNotify(`Pedido #${order.orderNumber} marcado como cancelado.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao cancelar pedido.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteOrder = async (order: OrderRecord) => {
    setProcessingId(order.id);
    onError('');
    try {
      await deleteOrder(order.id);
      setConfirmDeleteId(null);
      await onRefreshAll();
      onNotify(`Pedido #${order.orderNumber} excluído do histórico.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao excluir pedido.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold">
            Histórico de Pedidos & Baixa Automática
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            Todo pedido finalizado no site é salvo aqui. Ao confirmar o pagamento em 1 clique, o
            estoque da numeração é reduzido e o lucro vai direto para a calculadora.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-stone-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
            Pendentes (WhatsApp)
          </p>
          <p className="font-mono-num text-2xl font-extrabold text-amber-700">
            {summary.pendingCount}
          </p>
        </div>
        <div className="bg-white border border-stone-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
            Confirmados & Baixados
          </p>
          <p className="font-mono-num text-2xl font-extrabold text-emerald-700">
            {summary.confirmedCount}
          </p>
        </div>
        <div className="bg-white border border-stone-200 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
            Total Confirmado
          </p>
          <p className="font-mono-num text-2xl font-extrabold text-[#111111]">
            {formatBRL(summary.confirmedRevenue)}
          </p>
        </div>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { key: 'pendente' as OrderFilter, label: `Pendentes (${summary.pendingCount})` },
            { key: 'confirmado' as OrderFilter, label: `Confirmados (${summary.confirmedCount})` },
            { key: 'cancelado' as OrderFilter, label: `Cancelados (${summary.canceledCount})` },
            { key: 'todos' as OrderFilter, label: `Todos (${orders.length})` },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer transition-colors min-h-[40px] ${
                  active
                    ? 'bg-[#111111] text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:border-[#111111]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar #pedido, cliente ou tênis..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 text-sm focus:outline-none focus:border-[#111111] min-h-[40px]"
          />
        </div>
      </div>

      {/* Order List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-stone-200 p-10 text-center">
          <ClipboardList className="w-8 h-8 text-stone-300 mx-auto mb-2.5" />
          <p className="font-display text-sm font-bold text-[#111111] mb-1">
            Nenhum pedido nesta visualização
          </p>
          <p className="text-xs text-stone-500">
            Quando clientes finalizarem o carrinho pela loja, os pedidos aparecerão aqui para
            acompanhamento.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const badge = getStatusBadge(order.status);
            const isBusy = processingId === order.id;
            const phoneDigits = normalizeWhatsAppDigits(order.customerPhone);
            const customerChatUrl = phoneDigits
              ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(
                  `Olá ${order.customerName}! Sobre o seu pedido #${order.orderNumber} na Samuka Tênis:`
                )}`
              : '';
            const selectedPayment = paymentByOrder[order.id] || order.paymentMethod || 'Pix';

            return (
              <div
                key={order.id}
                className="bg-white border border-stone-200 p-4 sm:p-5 space-y-4"
              >
                {/* Top Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono-num text-sm font-extrabold text-[#111111]">
                      #{order.orderNumber}
                    </span>
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                      <Clock className="w-3.5 h-3.5" />
                      {formatOrderTimestamp(order.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 bg-stone-100 px-2.5 py-1">
                      {order.deliveryMethod === 'pickup' ? (
                        <>
                          <Store className="w-3.5 h-3.5" />
                          <span>Retirar na loja</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5" />
                          <span>Entrega {order.customerCep ? `· ${order.customerCep}` : ''}</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Customer + Order Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5 space-y-2 text-xs text-stone-700 bg-[#FAFAFA] border border-stone-200 p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Cliente
                    </p>
                    <p className="text-sm font-bold text-[#111111]">{order.customerName}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono-num font-medium">{order.customerPhone}</span>
                      {customerChatUrl && (
                        <a
                          href={customerChatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                    {order.deliveryMethod === 'delivery' && order.customerAddress && (
                      <p className="flex items-start gap-1.5 text-stone-600 pt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-400" />
                        <span>{order.customerAddress}</span>
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-xs text-stone-600 pt-1 border-t border-stone-200">
                        <strong>Obs:</strong> {order.notes}
                      </p>
                    )}
                  </div>

                  <div className="lg:col-span-7 space-y-2.5">
                    {order.items.map((item, idx) => {
                      const matchedProduct = products.find((p) => p.id === item.productId);
                      const hasCost = Boolean(matchedProduct && (matchedProduct.costPrice ?? 0) > 0);
                      return (
                        <div
                          key={`${order.id}-${item.productId}-${item.size}-${idx}`}
                          className="flex items-center gap-3 pb-2.5 border-b border-stone-100 last:border-b-0 last:pb-0"
                        >
                          <div className="w-12 h-12 bg-[#F5F5F4] shrink-0 overflow-hidden">
                            <SmartImage
                              src={item.image || matchedProduct?.images?.[0] || ''}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-[#111111] truncate">
                              {item.productName}
                            </p>
                            <p className="font-mono-num text-[11px] text-stone-600">
                              {item.brandName ? `${item.brandName} · ` : ''}
                              Tam {item.size}
                              {item.color ? ` · ${item.color}` : ''} · {item.quantity}x{' '}
                              {formatBRL(item.unitPrice)}
                            </p>
                            {!hasCost && order.status === 'pendente' && (
                              <p className="text-[10px] text-amber-700 font-medium">
                                Sem preço de custo cadastrado (custo será R$ 0,00 no lucro)
                              </p>
                            )}
                          </div>
                          <span className="font-mono-num text-xs font-bold text-[#111111] shrink-0">
                            {formatBRL(item.unitPrice * item.quantity)}
                          </span>
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200 text-xs">
                      <div className="text-stone-600 space-x-3">
                        <span>
                          Subtotal: <strong className="font-mono-num">{formatBRL(order.subtotal)}</strong>
                        </span>
                        <span>
                          Frete:{' '}
                          <strong className="font-mono-num">
                            {order.shippingCost > 0
                              ? formatBRL(order.shippingCost)
                              : order.deliveryMethod === 'pickup'
                                ? 'Retirada'
                                : 'A confirmar'}
                          </strong>
                        </span>
                      </div>
                      <span className="font-mono-num text-sm font-extrabold text-[#111111]">
                        Total: {formatBRL(order.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Bar */}
                {order.status === 'pendente' ? (
                  <div className="pt-3 border-t border-stone-200 bg-[#FAFAFA] p-3.5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                          Forma de pagamento
                        </label>
                        <select
                          value={selectedPayment}
                          onChange={(e) =>
                            setPaymentByOrder((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 bg-white border border-stone-300 text-xs font-medium focus:outline-none focus:border-[#111111] min-h-[38px]"
                        >
                          {PAYMENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                          Taxa / Frete pago pela loja (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={feeByOrder[order.id] ?? ''}
                          onChange={(e) =>
                            setFeeByOrder((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          placeholder="0,00"
                          className="font-mono-num w-full px-3 py-2 bg-white border border-stone-300 text-xs focus:outline-none focus:border-[#111111] min-h-[38px]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                          Observação interna
                        </label>
                        <input
                          type="text"
                          maxLength={140}
                          value={notesByOrder[order.id] ?? ''}
                          onChange={(e) =>
                            setNotesByOrder((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          placeholder="Ex: Pago via Pix, enviando hoje..."
                          className="w-full px-3 py-2 bg-white border border-stone-300 text-xs focus:outline-none focus:border-[#111111] min-h-[38px]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConfirmOrder(order)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer min-h-[42px]"
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Confirmar Pago (Baixar Estoque + Lucro)</span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleCancelOrder(order)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-stone-300 bg-white hover:border-[#C8102E] hover:text-[#C8102E] text-xs font-bold uppercase tracking-wider text-stone-700 transition-colors disabled:opacity-50 cursor-pointer min-h-[42px]"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancelar pedido</span>
                        </button>
                      </div>

                      {confirmDeleteId === order.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteOrder(order)}
                            className="px-3 py-2 bg-[#C8102E] text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                          >
                            Confirmar exclusão
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-2 border border-stone-300 text-[11px] font-semibold text-stone-600 cursor-pointer"
                          >
                            Voltar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(order.id)}
                          className="p-2 text-stone-400 hover:text-[#C8102E] cursor-pointer"
                          aria-label={`Excluir pedido ${order.orderNumber}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs text-stone-500">
                    <span>
                      {order.status === 'confirmado'
                        ? `Pagamento confirmado (${order.paymentMethod || 'Pix'}) · Estoque e lucro atualizados.`
                        : 'Pedido cancelado — sem baixa no estoque.'}
                    </span>

                    {confirmDeleteId === order.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDeleteOrder(order)}
                          className="px-3 py-1.5 bg-[#C8102E] text-white text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                        >
                          Confirmar exclusão
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1.5 border border-stone-300 text-[11px] font-semibold text-stone-600 cursor-pointer"
                        >
                          Voltar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(order.id)}
                        className="inline-flex items-center gap-1 text-stone-400 hover:text-[#C8102E] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

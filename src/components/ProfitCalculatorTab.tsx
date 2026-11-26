import { useMemo, useState } from 'react';
import {
  Calculator,
  Calendar,
  DollarSign,
  PlusCircle,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { recordSale, deleteSale, updateProductStock } from '../lib/storeService';
import { formatBRL, getLocalISODate } from '../lib/utils';
import type { Product, SaleRecord } from '../types';

interface ProfitCalculatorTabProps {
  products: Product[];
  sales: SaleRecord[];
  onRefreshAll: () => Promise<void>;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

type PeriodFilter = 'dia' | 'semana' | 'mes' | 'todos';

function formatBRDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function ProfitCalculatorTab({
  products,
  sales,
  onRefreshAll,
  onNotify,
  onError,
}: ProfitCalculatorTabProps) {
  const todayIso = getLocalISODate(new Date());
  const weekAgoDate = new Date();
  weekAgoDate.setDate(weekAgoDate.getDate() - 6);
  const weekStartIso = getLocalISODate(weekAgoDate);
  const monthPrefix = todayIso.slice(0, 7); // YYYY-MM

  // Calculator & Sale Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productName, setProductName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [extraFee, setExtraFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [soldDate, setSoldDate] = useState(todayIso);
  const [notes, setNotes] = useState('');
  const [deductStock, setDeductStock] = useState(true);
  const [savingSale, setSavingSale] = useState(false);

  // Ledger Filter State
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('dia');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const handleSelectCatalogProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) {
      return;
    }
    const effectivePrice =
      prod.isPromo && prod.promoPrice > 0 && prod.promoPrice < prod.price
        ? prod.promoPrice
        : prod.price;

    setProductName(prod.name);
    setBrandName(prod.brandName);
    setSalePrice(effectivePrice);
    setCostPrice(prod.costPrice ?? 0);

    const availableSize = Object.entries(prod.sizes || {})
      .sort(([a], [b]) => Number(a) - Number(b))
      .find(([, qty]) => qty > 0);
    setSize(availableSize ? availableSize[0] : '');
  };

  // Live Calculator Numbers
  const calcRevenue = Math.max(0, salePrice) * Math.max(1, quantity);
  const calcTotalCost = Math.max(0, costPrice) * Math.max(1, quantity) + Math.max(0, extraFee);
  const calcProfit = calcRevenue - calcTotalCost;
  const calcMargin = calcRevenue > 0 ? (calcProfit / calcRevenue) * 100 : 0;

  // Aggregated Summaries (Day / Week / Month / All)
  const summaries = useMemo(() => {
    const acc = {
      dia: { profit: 0, revenue: 0, pairs: 0, count: 0 },
      semana: { profit: 0, revenue: 0, pairs: 0, count: 0 },
      mes: { profit: 0, revenue: 0, pairs: 0, count: 0 },
      todos: { profit: 0, revenue: 0, pairs: 0, count: 0 },
    };

    for (const s of sales) {
      const qty = Number(s.quantity) || 1;
      const rev = (Number(s.salePrice) || 0) * qty;
      const prof = Number(s.profit) || 0;

      acc.todos.profit += prof;
      acc.todos.revenue += rev;
      acc.todos.pairs += qty;
      acc.todos.count += 1;

      if (s.soldDate === todayIso) {
        acc.dia.profit += prof;
        acc.dia.revenue += rev;
        acc.dia.pairs += qty;
        acc.dia.count += 1;
      }
      if (s.soldDate >= weekStartIso && s.soldDate <= todayIso) {
        acc.semana.profit += prof;
        acc.semana.revenue += rev;
        acc.semana.pairs += qty;
        acc.semana.count += 1;
      }
      if (s.soldDate.startsWith(monthPrefix)) {
        acc.mes.profit += prof;
        acc.mes.revenue += rev;
        acc.mes.pairs += qty;
        acc.mes.count += 1;
      }
    }

    return acc;
  }, [sales, todayIso, weekStartIso, monthPrefix]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (periodFilter === 'dia') return s.soldDate === todayIso;
      if (periodFilter === 'semana') return s.soldDate >= weekStartIso && s.soldDate <= todayIso;
      if (periodFilter === 'mes') return s.soldDate.startsWith(monthPrefix);
      return true;
    });
  }, [sales, periodFilter, todayIso, weekStartIso, monthPrefix]);

  const activePeriodStats = summaries[periodFilter];

  const handleRecordSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      onError('Informe o nome do tênis ou item vendido.');
      return;
    }

    setSavingSale(true);
    try {
      await recordSale({
        productId: selectedProduct?.id || '',
        productName: productName.trim(),
        brandName: brandName.trim(),
        size: size.trim(),
        quantity,
        salePrice,
        costPrice,
        extraFee,
        profit: calcProfit,
        paymentMethod,
        notes: notes.trim(),
        soldDate,
      });

      // Optionally deduct sold pairs from product size stock
      if (deductStock && selectedProduct && size.trim()) {
        const currentQty = selectedProduct.sizes?.[size.trim()] ?? 0;
        const nextQty = Math.max(0, currentQty - quantity);
        const nextSizes = {
          ...(selectedProduct.sizes || {}),
          [size.trim()]: nextQty,
        };
        await updateProductStock(selectedProduct.id, nextSizes);
      }

      setNotes('');
      setExtraFee(0);
      setQuantity(1);
      await onRefreshAll();
      onNotify(
        `Venda registrada! Lucro líquido: ${formatBRL(calcProfit)}${
          deductStock && selectedProduct && size ? ' (estoque atualizado)' : ''
        }.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao registrar venda.');
    } finally {
      setSavingSale(false);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    try {
      await deleteSale(saleId);
      await onRefreshAll();
      onNotify('Registro de venda removido.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao remover registro.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg sm:text-xl font-extrabold">
          Calculadora de Lucros & Vendas
        </h2>
        <p className="text-xs sm:text-sm text-stone-600">
          Simule margens, registre cada tênis vendido e acompanhe quanto lucrou no dia, na semana e
          no mês.
        </p>
      </div>

      {/* Period KPI Cards: Dia / Semana / Mês / Total */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            key: 'dia' as PeriodFilter,
            title: 'Lucro Hoje (Dia)',
            sub: formatBRDate(todayIso),
            stats: summaries.dia,
          },
          {
            key: 'semana' as PeriodFilter,
            title: 'Lucro da Semana',
            sub: 'Últimos 7 dias',
            stats: summaries.semana,
          },
          {
            key: 'mes' as PeriodFilter,
            title: 'Lucro do Mês',
            sub: `${monthPrefix.slice(5)}/${monthPrefix.slice(0, 4)}`,
            stats: summaries.mes,
          },
          {
            key: 'todos' as PeriodFilter,
            title: 'Lucro Acumulado',
            sub: 'Todo o histórico',
            stats: summaries.todos,
          },
        ].map((card) => {
          const isSelected = periodFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setPeriodFilter(card.key)}
              className={`text-left p-4 sm:p-5 border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111] border-stone-200 hover:border-[#111111]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    isSelected ? 'text-stone-300' : 'text-stone-500'
                  }`}
                >
                  {card.title}
                </span>
                <TrendingUp
                  className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-emerald-700'}`}
                />
              </div>
              <p
                className={`font-mono-num text-2xl font-extrabold ${
                  card.stats.profit >= 0
                    ? isSelected
                      ? 'text-emerald-400'
                      : 'text-emerald-700'
                    : 'text-[#C8102E]'
                }`}
              >
                {formatBRL(card.stats.profit)}
              </p>
              <div
                className={`mt-2 pt-2 border-t text-[11px] flex items-center justify-between ${
                  isSelected ? 'border-stone-800 text-stone-300' : 'border-stone-100 text-stone-500'
                }`}
              >
                <span>{card.stats.pairs} par(es)</span>
                <span>Venda: {formatBRL(card.stats.revenue)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Profit Calculator + Sale Recorder */}
      <form
        onSubmit={handleRecordSaleSubmit}
        className="bg-white border border-stone-200 p-4 sm:p-6 space-y-5"
      >
        <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
          <Calculator className="w-5 h-5 text-[#C8102E]" />
          <div>
            <h3 className="font-display text-base font-extrabold">
              Calcular Lucro & Registrar Item Vendido
            </h3>
            <p className="text-xs text-stone-500">
              Escolha um tênis cadastrado ou digite manualmente para calcular na hora e salvar no
              histórico.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Puxar do catálogo (opcional)
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => handleSelectCatalogProduct(e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-300 text-sm bg-white min-h-[44px]"
            >
              <option value="">-- Digitar item manualmente --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.brandName}) — {formatBRL(p.isPromo && p.promoPrice > 0 ? p.promoPrice : p.price)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Data da venda
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                required
                value={soldDate}
                onChange={(e) => setSoldDate(e.target.value)}
                className="font-mono-num w-full pl-9 pr-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Item vendido *
            </label>
            <input
              type="text"
              required
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Nike Shox R4 Preto"
              className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Marca
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Ex: Nike"
              className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Numeração
              </label>
              {selectedProduct ? (
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm bg-white min-h-[44px]"
                >
                  <option value="">Sem tam.</option>
                  {Object.entries(selectedProduct.sizes || {})
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([s, qty]) => (
                      <option key={s} value={s}>
                        {s} ({qty} est.)
                      </option>
                    ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="Ex: 40"
                  className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                Qtd. pares
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Valor vendido unitário (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={salePrice}
              onChange={(e) => setSalePrice(Math.max(0, Number(e.target.value) || 0))}
              className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Custo de compra unitário (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(Math.max(0, Number(e.target.value) || 0))}
              className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Taxas / Frete / Maquininha (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={extraFee}
              onChange={(e) => setExtraFee(Math.max(0, Number(e.target.value) || 0))}
              className="font-mono-num w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Forma de pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-300 text-sm bg-white min-h-[44px]"
            >
              <option value="Pix">Pix</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="WhatsApp / Outro">WhatsApp / Outro</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
              Observação (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Cliente João, entrega motoboy"
              className="w-full px-3 py-2.5 border border-stone-300 text-sm min-h-[44px]"
            />
          </div>
        </div>

        {/* Live Calculation Preview Box */}
        <div className="bg-[#FAFAFA] border border-stone-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Total Vendido
              </p>
              <p className="font-mono-num text-sm sm:text-base font-bold text-[#111111]">
                {formatBRL(calcRevenue)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Custo + Taxas
              </p>
              <p className="font-mono-num text-sm sm:text-base font-bold text-stone-600">
                {formatBRL(calcTotalCost)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Lucro Líquido ({calcMargin.toFixed(0)}%)
              </p>
              <p
                className={`font-mono-num text-base sm:text-lg font-extrabold ${
                  calcProfit >= 0 ? 'text-emerald-700' : 'text-[#C8102E]'
                }`}
              >
                {formatBRL(calcProfit)}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            {selectedProduct && size && (
              <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deductStock}
                  onChange={(e) => setDeductStock(e.target.checked)}
                  className="w-4 h-4 accent-[#111111]"
                />
                <span>Abater {quantity} par(es) do estoque tam. {size}</span>
              </label>
            )}
            <button
              type="submit"
              disabled={savingSale}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{savingSale ? 'Salvando...' : 'Registrar Venda e Lucro'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Ledger of Sold Items for Selected Period */}
      <div className="bg-white border border-stone-200">
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#C8102E]" />
            <h3 className="font-display text-base font-extrabold">
              Itens Vendidos —{' '}
              {periodFilter === 'dia'
                ? 'Hoje'
                : periodFilter === 'semana'
                  ? 'Últimos 7 dias'
                  : periodFilter === 'mes'
                    ? 'Este Mês'
                    : 'Todos os Registros'}
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'dia', label: 'Hoje' },
                { key: 'semana', label: 'Semana' },
                { key: 'mes', label: 'Mês' },
                { key: 'todos', label: 'Todos' },
              ] as { key: PeriodFilter; label: string }[]
            ).map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => setPeriodFilter(btn.key)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border cursor-pointer ${
                  periodFilter === btn.key
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-white text-stone-600 border-stone-300 hover:border-[#111111]'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 bg-[#FAFAFA] border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-stone-600">
            <strong className="text-[#111111]">{activePeriodStats.count}</strong> venda(s) ·{' '}
            <strong className="text-[#111111]">{activePeriodStats.pairs}</strong> par(es) vendido(s)
          </span>
          <div className="flex items-center gap-4 font-mono-num">
            <span className="text-stone-600">
              Faturado: <strong className="text-[#111111]">{formatBRL(activePeriodStats.revenue)}</strong>
            </span>
            <span className="text-emerald-700 font-bold">
              Lucro no período: {formatBRL(activePeriodStats.profit)}
            </span>
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            Nenhuma venda registrada neste período. Use a calculadora acima para registrar um item
            vendido.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredSales.map((sale) => {
              const rev = (sale.salePrice || 0) * (sale.quantity || 1);
              const costTotal = (sale.costPrice || 0) * (sale.quantity || 1) + (sale.extraFee || 0);
              return (
                <div
                  key={sale.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-stone-50"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                      <span className="font-mono-num font-bold text-[#111111]">
                        {formatBRDate(sale.soldDate)}
                      </span>
                      {sale.brandName && <span>· {sale.brandName}</span>}
                      {sale.size && <span>· Tam. {sale.size}</span>}
                      <span>· {sale.quantity} par(es)</span>
                      <span>· {sale.paymentMethod}</span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-[#111111] truncate">
                      {sale.productName}
                    </h4>
                    {sale.notes && <p className="text-xs text-stone-500">{sale.notes}</p>}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-5 shrink-0">
                    <div className="font-mono-num text-xs text-stone-500 text-right">
                      <div>Vendido: {formatBRL(rev)}</div>
                      <div>Custo: {formatBRL(costTotal)}</div>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-stone-400">
                        Lucro
                      </span>
                      <span
                        className={`font-mono-num text-sm sm:text-base font-extrabold ${
                          sale.profit >= 0 ? 'text-emerald-700' : 'text-[#C8102E]'
                        }`}
                      >
                        {sale.profit >= 0 ? '+' : ''}
                        {formatBRL(sale.profit)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSale(sale.id)}
                      className="p-2 text-stone-400 hover:text-[#C8102E] cursor-pointer"
                      aria-label={`Excluir venda ${sale.productName}`}
                      title="Excluir venda"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

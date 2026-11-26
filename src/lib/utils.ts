import type { CartItem, CustomerOrderInfo, Product, ShippingQuote, StoreConfig } from '../types';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function buildProductShareUrl(product: Product): string {
  if (typeof window === 'undefined') return '';
  const slug = encodeURIComponent(product.slug || product.id);
  return `${window.location.origin}/tenis/${slug}`;
}

export async function shareSneaker(
  product: Product,
  storeName: string
): Promise<{
  outcome: 'shared' | 'copied' | 'cancelled' | 'manual';
  url: string;
  shareText: string;
  whatsappShareUrl: string;
}> {
  const url = buildProductShareUrl(product);
  const hasPromo =
    product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
  const effectivePrice = hasPromo ? product.promoPrice : product.price;
  const priceLabel = effectivePrice > 0 ? ` por ${formatBRL(effectivePrice)}` : '';
  const shareText = `Confira ${product.name} (${product.brandName})${priceLabel} na ${
    storeName || 'SAMUKA TÊNIS'
  }:`;
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `${product.name} | ${storeName || 'SAMUKA TÊNIS'}`,
        text: shareText,
        url,
      });
      return { outcome: 'shared', url, shareText, whatsappShareUrl };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { outcome: 'cancelled', url, shareText, whatsappShareUrl };
      }
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { outcome: 'copied', url, shareText, whatsappShareUrl };
    } catch {
      // Fallback to manual share menu
    }
  }

  return { outcome: 'manual', url, shareText, whatsappShareUrl };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function sanitizeImageUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('firestore-media://')
  ) {
    return trimmed;
  }
  return '';
}

export function sanitizeVideoUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed.slice(0, 500);
  }
  return '';
}

export function parseVideoSource(url: string): {
  kind: 'youtube' | 'vimeo' | 'direct';
  src: string;
} {
  const clean = sanitizeVideoUrl(url);
  if (!clean) return { kind: 'direct', src: '' };

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) {
        return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
      }
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) {
          return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
        }
      }
      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) {
          return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
        }
      }
      const v = parsed.searchParams.get('v');
      if (v) {
        return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${v}?rel=0` };
      }
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) {
        return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` };
      }
    }
  } catch {
    // Fallback to direct video tag
  }

  return { kind: 'direct', src: clean };
}

export function getLocalISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sanitizeExternalHref(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('@')) {
    return `https://instagram.com/${trimmed.slice(1)}`;
  }
  return '';
}

export function normalizeWhatsAppDigits(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

export function formatCepInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
}

export async function lookupCep(cep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null> {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (data.erro) return null;
  return {
    street: data.logradouro || '',
    neighborhood: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
  };
}

export async function calculateShippingQuote(
  cep: string,
  config: StoreConfig,
  subtotal: number,
  resolvedLocation?: { city?: string; state?: string } | null
): Promise<ShippingQuote> {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) {
    return {
      status: 'error',
      price: null,
      estimatedDays: '',
      modality: '',
      message: 'Informe um CEP válido com 8 dígitos.',
    };
  }

  const destinationLabel =
    resolvedLocation?.city && resolvedLocation?.state
      ? `${resolvedLocation.city}/${resolvedLocation.state}`
      : `CEP ${formatCepInput(cleanCep)}`;

  if (config.shippingMode === 'external_api' && config.shippingApiEndpoint) {
    try {
      const endpoint = sanitizeExternalHref(config.shippingApiEndpoint);
      if (!endpoint) throw new Error('Endpoint inválido');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cep: cleanCep, subtotal }),
      });
      if (!res.ok) throw new Error('Falha na consulta de frete');
      const payload = (await res.json()) as {
        price?: number;
        estimatedDays?: string;
        modality?: string;
      };
      if (typeof payload.price === 'number') {
        return {
          status: 'calculated',
          price: payload.price,
          estimatedDays: payload.estimatedDays || 'Prazo sujeito a confirmação',
          modality: payload.modality || `Entrega para ${destinationLabel}`,
          message:
            'Valor estimado pela transportadora. O frete pode sofrer alterações na confirmação do pedido pela loja.',
        };
      }
    } catch {
      return {
        status: 'confirm_store',
        price: null,
        estimatedDays: '',
        modality: `Entrega para ${destinationLabel}`,
        message:
          'Não foi possível consultar a transportadora no momento. O valor e prazo podem sofrer alterações e serão confirmados pela loja no WhatsApp.',
      };
    }
  }

  if (config.shippingMode === 'fixed_rate') {
    return {
      status: 'calculated',
      price: config.fixedShippingPrice,
      estimatedDays: config.fixedShippingDays || 'Prazo a confirmar com a loja',
      modality: `Entrega para ${destinationLabel}`,
      message:
        config.fixedShippingPrice === 0
          ? 'Frete grátis estimado. Condições podem sofrer alterações conforme CEP e confirmação da loja.'
          : 'Valor de frete estimado. Pode sofrer alterações conforme região e modalidade na confirmação da loja.',
    };
  }

  return {
    status: 'confirm_store',
    price: null,
    estimatedDays: 'A confirmar conforme modalidade (PAC / SEDEX / Entrega local)',
    modality: `Entrega para ${destinationLabel}`,
    message:
      'CEP localizado! Como o frete varia por peso, região e modalidade de envio, o valor calculado pode sofrer alterações e será confirmado com você no WhatsApp antes do pagamento.',
  };
}

export function buildWhatsAppOrderMessage(params: {
  orderNumber?: string;
  storeName: string;
  items: CartItem[];
  subtotal: number;
  deliveryMethod: 'delivery' | 'pickup';
  shippingQuote: ShippingQuote;
  pickupFree: boolean;
  customer: CustomerOrderInfo;
}): string {
  const {
    orderNumber,
    storeName,
    items,
    subtotal,
    deliveryMethod,
    shippingQuote,
    pickupFree,
    customer,
  } = params;
  const lines: string[] = [];

  lines.push(`Olá! Gostaria de realizar um pedido na ${storeName || 'Samuka Tênis'}.`);
  if (orderNumber) {
    lines.push(`*Pedido:* #${orderNumber}`);
  }
  lines.push('');
  lines.push('*MEU PEDIDO:*');
  lines.push('');

  items.forEach((item, index) => {
    const itemTotal = item.unitPrice * item.quantity;
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`Marca: ${item.brandName}`);
    lines.push(`Tamanho: ${item.size}`);
    if (item.color) {
      lines.push(`Cor: ${item.color}`);
    }
    lines.push(`Quantidade: ${item.quantity}`);
    lines.push(`Valor: ${formatBRL(itemTotal)}`);
    lines.push('');
  });

  const shippingCost =
    deliveryMethod === 'pickup'
      ? pickupFree
        ? 0
        : null
      : shippingQuote.status === 'calculated' && shippingQuote.price !== null
        ? shippingQuote.price
        : null;

  const shippingLabel =
    deliveryMethod === 'pickup'
      ? pickupFree
        ? 'Grátis (Retirada na loja)'
        : 'A confirmar (Retirada na loja)'
      : shippingCost !== null
        ? `${formatBRL(shippingCost)}${
            shippingQuote.estimatedDays ? ` (${shippingQuote.estimatedDays})` : ''
          } — sujeito a alterações pela loja`
        : 'A calcular / confirmar com a loja (pode sofrer alterações)';

  const totalValue = subtotal + (shippingCost ?? 0);

  lines.push('*RESUMO:*');
  lines.push(`Subtotal: ${formatBRL(subtotal)}`);
  lines.push(`Frete: ${shippingLabel}`);
  lines.push(
    `Total: ${formatBRL(totalValue)}${
      deliveryMethod === 'delivery' ? ' (frete sujeito a alterações na confirmação)' : ''
    }`
  );
  lines.push('');
  lines.push('*FORMA DE RECEBIMENTO:*');
  lines.push(deliveryMethod === 'pickup' ? 'Retirar na loja' : 'Receber em casa (Entrega)');
  lines.push('');
  lines.push('*DADOS DO CLIENTE:*');
  lines.push(`Nome: ${customer.name || '-'}`);
  lines.push(`Telefone: ${customer.phone || '-'}`);

  if (deliveryMethod === 'delivery') {
    lines.push(`CEP: ${customer.cep || '-'}`);
    const addressParts = [
      customer.street,
      customer.number ? `nº ${customer.number}` : '',
      customer.complement,
      customer.neighborhood,
      customer.city && customer.state ? `${customer.city}/${customer.state}` : customer.city,
    ].filter(Boolean);
    lines.push(`Endereço: ${addressParts.length > 0 ? addressParts.join(', ') : '-'}`);
  }

  return lines.join('\n');
}

export function buildWhatsAppUrl(whatsappNumber: string, message: string): string {
  const digits = normalizeWhatsAppDigits(whatsappNumber);
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function compressImageToBase64(
  file: File,
  maxWidth = 900,
  quality = 0.8
): Promise<{ mimeType: 'image/webp' | 'image/jpeg'; base64Data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não reconhecido como imagem válida.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Contexto gráfico indisponível.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let mimeType: 'image/webp' | 'image/jpeg' = 'image/webp';
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const base64Data = dataUrl.split(',')[1] || '';
        if (!base64Data || base64Data.length > 340000) {
          const fallbackUrl = canvas.toDataURL('image/jpeg', 0.6);
          const fallbackB64 = fallbackUrl.split(',')[1] || '';
          if (fallbackB64.length > 340000) {
            reject(new Error('Imagem muito pesada mesmo após compressão. Utilize uma foto menor.'));
            return;
          }
          resolve({ mimeType: 'image/jpeg', base64Data: fallbackB64 });
          return;
        }

        resolve({ mimeType, base64Data });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

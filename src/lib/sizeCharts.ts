export interface SizeChartRow {
  br: string;
  cm: string;
  us: string;
}

export interface BrandSizeChart {
  key: string;
  label: string;
  fitNote: string;
  rows: SizeChartRow[];
}

export const SIZE_CHARTS: Record<string, BrandSizeChart> = {
  nike: {
    key: 'nike',
    label: 'Nike',
    fitNote: 'Forma padrão esportiva Nike. Para pés largos ou corrida longa, considere 0,5 cm extra.',
    rows: [
      { br: '34', cm: '22,0', us: '4Y / 5.5W' },
      { br: '35', cm: '22,5', us: '4.5Y / 6W' },
      { br: '36', cm: '23,5', us: '5.5Y / 7W' },
      { br: '37', cm: '24,0', us: '6 / 7.5W' },
      { br: '38', cm: '25,0', us: '7 / 8.5W' },
      { br: '39', cm: '25,5', us: '7.5 / 9W' },
      { br: '40', cm: '26,5', us: '8.5' },
      { br: '41', cm: '27,5', us: '9.5' },
      { br: '42', cm: '28,0', us: '10' },
      { br: '43', cm: '29,0', us: '11' },
      { br: '44', cm: '30,0', us: '12' },
    ],
  },
  'new-balance': {
    key: 'new-balance',
    label: 'New Balance',
    fitNote: 'Modelos como 9060, 550 e 2002R têm forma fiel ao tamanho BR com boa largura frontal.',
    rows: [
      { br: '34', cm: '21,5', us: '4.5W' },
      { br: '35', cm: '22,5', us: '5.5W' },
      { br: '36', cm: '23,0', us: '6W' },
      { br: '37', cm: '24,0', us: '7W / 5.5' },
      { br: '38', cm: '25,0', us: '7' },
      { br: '39', cm: '25,5', us: '7.5' },
      { br: '40', cm: '26,5', us: '8.5' },
      { br: '41', cm: '27,5', us: '9.5' },
      { br: '42', cm: '28,0', us: '10' },
      { br: '43', cm: '29,0', us: '11' },
      { br: '44', cm: '30,0', us: '12' },
    ],
  },
  adidas: {
    key: 'adidas',
    label: 'Adidas',
    fitNote: 'Tabela oficial Adidas BR em centímetros. Modelos Samba/Campus vestem mais justos no peito do pé.',
    rows: [
      { br: '34', cm: '22,1', us: '5W' },
      { br: '35', cm: '22,9', us: '6W' },
      { br: '36', cm: '23,8', us: '7W' },
      { br: '37', cm: '24,6', us: '6.5' },
      { br: '38', cm: '25,5', us: '7.5' },
      { br: '39', cm: '25,9', us: '8' },
      { br: '40', cm: '26,7', us: '9' },
      { br: '41', cm: '27,1', us: '9.5' },
      { br: '42', cm: '28,0', us: '10.5' },
      { br: '43', cm: '28,8', us: '11.5' },
      { br: '44', cm: '29,3', us: '12' },
    ],
  },
  puma: {
    key: 'puma',
    label: 'Puma',
    fitNote: 'Modelos Puma Suede e RS-X seguem forma regular; se tiver o pé bem largo, compare os cm.',
    rows: [
      { br: '34', cm: '22,0', us: '5.5W' },
      { br: '35', cm: '22,5', us: '6W' },
      { br: '36', cm: '23,5', us: '7W' },
      { br: '37', cm: '24,0', us: '6' },
      { br: '38', cm: '25,0', us: '7' },
      { br: '39', cm: '26,0', us: '8' },
      { br: '40', cm: '26,5', us: '8.5' },
      { br: '41', cm: '27,5', us: '9.5' },
      { br: '42', cm: '28,0', us: '10' },
      { br: '43', cm: '29,0', us: '11' },
      { br: '44', cm: '30,0', us: '12' },
    ],
  },
  mizuno: {
    key: 'mizuno',
    label: 'Mizuno',
    fitNote: 'Padrão japonês preciso em centímetros para corrida e linha Wave Prophecy.',
    rows: [
      { br: '34', cm: '22,0', us: '5W' },
      { br: '35', cm: '22,5', us: '5.5W' },
      { br: '36', cm: '23,5', us: '6.5W' },
      { br: '37', cm: '24,0', us: '6' },
      { br: '38', cm: '25,0', us: '7' },
      { br: '39', cm: '25,5', us: '7.5' },
      { br: '40', cm: '26,5', us: '8.5' },
      { br: '41', cm: '27,5', us: '9.5' },
      { br: '42', cm: '28,0', us: '10' },
      { br: '43', cm: '29,0', us: '11' },
      { br: '44', cm: '30,0', us: '12' },
    ],
  },
  asics: {
    key: 'asics',
    label: 'Asics',
    fitNote: 'Modelos Asics Gel e Nimbus seguem medida padrão; ideal deixar 0,5 cm de folga para corrida.',
    rows: [
      { br: '34', cm: '22,0', us: '5.5W' },
      { br: '35', cm: '22,75', us: '6W' },
      { br: '36', cm: '23,5', us: '7W' },
      { br: '37', cm: '24,5', us: '6.5' },
      { br: '38', cm: '25,25', us: '7.5' },
      { br: '39', cm: '25,75', us: '8' },
      { br: '40', cm: '26,5', us: '8.5' },
      { br: '41', cm: '27,5', us: '9.5' },
      { br: '42', cm: '28,25', us: '10.5' },
      { br: '43', cm: '29,0', us: '11.5' },
      { br: '44', cm: '29,5', us: '12' },
    ],
  },
  olympikus: {
    key: 'olympikus',
    label: 'Olympikus',
    fitNote: 'Grade nacional Olympikus já calibrada ao pé brasileiro com excelente conforto anatômico.',
    rows: [
      { br: '34', cm: '22,8', us: '5.5W' },
      { br: '35', cm: '23,5', us: '6W' },
      { br: '36', cm: '24,1', us: '7W' },
      { br: '37', cm: '24,8', us: '6.5' },
      { br: '38', cm: '25,5', us: '7.5' },
      { br: '39', cm: '26,1', us: '8' },
      { br: '40', cm: '26,8', us: '9' },
      { br: '41', cm: '27,5', us: '9.5' },
      { br: '42', cm: '28,1', us: '10.5' },
      { br: '43', cm: '28,8', us: '11.5' },
      { br: '44', cm: '29,5', us: '12' },
    ],
  },
  vans: {
    key: 'vans',
    label: 'Vans',
    fitNote: 'Vans Old Skool e Knu Skool vestem fiel ao número BR. Para Knu Skool com língua acolchoada, confira os cm.',
    rows: [
      { br: '34', cm: '21,5', us: '5W' },
      { br: '35', cm: '22,5', us: '6W' },
      { br: '36', cm: '23,0', us: '6.5W' },
      { br: '37', cm: '24,0', us: '6' },
      { br: '38', cm: '25,0', us: '7' },
      { br: '39', cm: '25,5', us: '7.5' },
      { br: '40', cm: '26,5', us: '8.5' },
      { br: '41', cm: '27,5', us: '9.5' },
      { br: '42', cm: '28,0', us: '10' },
      { br: '43', cm: '29,0', us: '11' },
      { br: '44', cm: '30,0', us: '12' },
    ],
  },
  converse: {
    key: 'converse',
    label: 'Converse',
    fitNote: 'Atenção: All Star / Chuck Taylor costuma ter forma cerca de 0,5 cm maior que outras marcas.',
    rows: [
      { br: '34', cm: '22,5', us: '4' },
      { br: '35', cm: '23,5', us: '5' },
      { br: '36', cm: '24,5', us: '6' },
      { br: '37', cm: '25,0', us: '6.5' },
      { br: '38', cm: '26,0', us: '7.5' },
      { br: '39', cm: '26,5', us: '8' },
      { br: '40', cm: '27,5', us: '9' },
      { br: '41', cm: '28,5', us: '10' },
      { br: '42', cm: '29,0', us: '10.5' },
      { br: '43', cm: '29,5', us: '11' },
      { br: '44', cm: '30,5', us: '12' },
    ],
  },
  infantil: {
    key: 'infantil',
    label: 'Infantil',
    fitNote: 'Para crianças em fase de crescimento, recomenda-se escolher 0,5 cm acima do comprimento do pé.',
    rows: [
      { br: '26', cm: '16,5', us: '9.5C' },
      { br: '27', cm: '17,0', us: '10C' },
      { br: '28', cm: '18,0', us: '11C' },
      { br: '29', cm: '18,5', us: '11.5C' },
      { br: '30', cm: '19,5', us: '12.5C' },
      { br: '31', cm: '20,0', us: '13C' },
      { br: '32', cm: '20,5', us: '1Y' },
      { br: '33', cm: '21,5', us: '2Y' },
      { br: '34', cm: '22,0', us: '3Y' },
    ],
  },
};

export const SIZE_CHART_KEYS = [
  'nike',
  'new-balance',
  'adidas',
  'puma',
  'mizuno',
  'asics',
  'olympikus',
  'vans',
  'converse',
  'infantil',
] as const;

export function resolveSizeChartKey(brandName?: string, gender?: string): string {
  if (gender === 'infantil') {
    return 'infantil';
  }
  const normalized = (brandName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (normalized.includes('new balance') || normalized.includes('nb')) return 'new-balance';
  if (normalized.includes('adidas')) return 'adidas';
  if (normalized.includes('puma')) return 'puma';
  if (normalized.includes('mizuno')) return 'mizuno';
  if (normalized.includes('asics')) return 'asics';
  if (normalized.includes('olympikus')) return 'olympikus';
  if (normalized.includes('vans')) return 'vans';
  if (normalized.includes('converse') || normalized.includes('all star')) return 'converse';
  return 'nike';
}

import fifPriceList from '../data/fifPriceList.json';
import type { FIFPriceList, Motor } from '../types';

export const DEFAULT_FIF_PRICE_LIST = fifPriceList as FIFPriceList;
export const FIF_TENORS: number[] = DEFAULT_FIF_PRICE_LIST.tenors;

function normalizeModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(honda|all|new|evo)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

export function getFIFPriceListModel(name: string, priceList: FIFPriceList = DEFAULT_FIF_PRICE_LIST) {
  const exactMatch = priceList.models[name];
  if (exactMatch) return exactMatch;

  const normalizedName = normalizeModelName(name);
  return Object.entries(priceList.models).find(
    ([modelName]) => normalizeModelName(modelName) === normalizedName,
  )?.[1];
}

export function getMotorOtrPrice(
  motor: Pick<Motor, 'name' | 'price' | 'numericPrice'>,
  priceList: FIFPriceList = DEFAULT_FIF_PRICE_LIST,
): number {
  const price = getFIFPriceListModel(motor.name, priceList)?.price
    || motor.numericPrice
    || Number(String(motor.price || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export function normalizeMotorOtrPrice(motor: Motor, priceList: FIFPriceList = DEFAULT_FIF_PRICE_LIST): Motor {
  const price = getMotorOtrPrice(motor, priceList);
  return price ? { ...motor, price: price.toLocaleString('id-ID'), numericPrice: price } : motor;
}
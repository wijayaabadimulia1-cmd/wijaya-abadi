import fifPriceList from '../data/fifPriceList.json';
import type { Motor } from '../types';

export type FIFPriceListModel = {
  price: number;
  options: Record<string, number[]>;
};

const models = fifPriceList.models as Record<string, FIFPriceListModel>;
export const FIF_TENORS: number[] = fifPriceList.tenors;

export function getFIFPriceListModel(name: string): FIFPriceListModel | undefined {
  return models[name];
}

export function getMotorOtrPrice(motor: Pick<Motor, 'name' | 'price' | 'numericPrice'>): number {
  const price = getFIFPriceListModel(motor.name)?.price
    || motor.numericPrice
    || Number(String(motor.price || '').replace(/[^0-9]/g, ''));
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export function normalizeMotorOtrPrice(motor: Motor): Motor {
  const price = getMotorOtrPrice(motor);
  return price ? { ...motor, price: price.toLocaleString('id-ID'), numericPrice: price } : motor;
}
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_HERO_IMAGES } from '../constants';
import { FIF_DP_PERCENTAGES } from '../services/fifPriceList';
import { filterCatalogMotors } from './CatalogSection';

test('new dp percentages and hero upload limit are configured', () => {
  assert.deepEqual(FIF_DP_PERCENTAGES, [10, 13, 15, 20, 25]);
  assert.equal(MAX_HERO_IMAGES, 15);
});

test('motor without photo still remains visible in catalog results', () => {
  const motors = [
    {
      id: 'motor-1',
      name: 'Beat Street',
      category: 'Skutik',
      description: 'Motor harian yang praktis.',
      specs: ['125cc'],
      image: '',
      images: [],
      is_bestseller: false,
      numericPrice: 18000000,
      price: 'Rp 18.000.000',
    },
    {
      id: 'motor-2',
      name: 'Vario 125',
      category: 'Skutik',
      description: 'Motor matik premium.',
      specs: ['125cc'],
      image: '/uploads/vario.jpg',
      images: ['/uploads/vario.jpg'],
      is_bestseller: true,
      numericPrice: 22000000,
      price: 'Rp 22.000.000',
    },
  ] as any;

  const filtered = filterCatalogMotors(motors, 'Semua', '');

  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((motor) => motor.id), ['motor-1', 'motor-2']);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import type { Motor } from '../types';
import { filterSimulatorMotors } from './CreditSimulator';

const motors: Motor[] = [
  {
    id: 'vario-160',
    name: 'Honda Vario 160 ABS',
    category: 'Matic',
    price: 'Rp 27.000.000',
    numericPrice: 27000000,
    image: '',
    specs: ['160cc', 'Smart Key'],
    description: '',
  },
  {
    id: 'cbr-150',
    name: 'Honda CBR150R',
    category: 'Sport',
    price: 'Rp 38.000.000',
    numericPrice: 38000000,
    image: '',
    specs: ['150cc', 'ABS'],
    description: '',
  },
];

test('simulator search matches unit names, types, and multiple terms case-insensitively', () => {
  assert.deepEqual(filterSimulatorMotors(motors, '  HONDA   CBR '), [motors[1]]);
  assert.deepEqual(filterSimulatorMotors(motors, 'matic'), [motors[0]]);
  assert.deepEqual(filterSimulatorMotors(motors, 'smart key'), [motors[0]]);
});

test('simulator search returns all units when empty and none when unmatched', () => {
  assert.deepEqual(filterSimulatorMotors(motors, '  '), motors);
  assert.deepEqual(filterSimulatorMotors(motors, 'scoopy'), []);
});

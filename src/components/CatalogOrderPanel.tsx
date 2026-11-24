import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Save } from 'lucide-react';
import type { Motor } from '../types';
import { orderMotorsByIds } from '../catalogOrder';
import { formatRupiah } from '../services/api';

interface CatalogOrderPanelProps {
  motors: Motor[];
  savedOrder: string[];
  onSave: (order: string[]) => Promise<void>;
}

export function CatalogOrderPanel({ motors, savedOrder, onSave }: CatalogOrderPanelProps) {
  const savedOrderKey = JSON.stringify(savedOrder);
  const [order, setOrder] = useState(() => orderMotorsByIds(motors, savedOrder).map((motor) => motor.id));
  const [draggedMotorId, setDraggedMotorId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setOrder(orderMotorsByIds(motors, savedOrder).map((motor) => motor.id));
  }, [motors, savedOrderKey]);

  const orderedMotors = useMemo(() => orderMotorsByIds(motors, order), [motors, order]);
  const persistedOrder = useMemo(
    () => orderMotorsByIds(motors, savedOrder).map((motor) => motor.id),
    [motors, savedOrderKey],
  );
  const hasChanges = order.length !== persistedOrder.length || order.some((id, index) => id !== persistedOrder[index]);

  const moveMotor = (motorId: string, targetIndex: number) => {
    setOrder((current) => {
      const sourceIndex = current.indexOf(motorId);
      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.length || sourceIndex === targetIndex) return current;
      const next = [...current];
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, motorId);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(order);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-zinc-900/50 p-5 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Urutan Katalog Website</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Seret motor atau gunakan tombol panah. Urutan ini menjadi tampilan default katalog di website.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!hasChanges || isSaving}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Menyimpan...' : 'Simpan urutan'}
        </button>
      </header>

      {orderedMotors.length ? (
        <ol aria-label="Urutan katalog motor" className="space-y-2">
          {orderedMotors.map((motor, index) => (
            <li
              key={motor.id}
              draggable
              onDragStart={(event) => {
                setDraggedMotorId(motor.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', motor.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = draggedMotorId || event.dataTransfer.getData('text/plain');
                moveMotor(draggedId, index);
                setDraggedMotorId(null);
              }}
              onDragEnd={() => setDraggedMotorId(null)}
              className={`flex items-center gap-3 rounded-xl border bg-zinc-950/70 p-3 ${
                draggedMotorId === motor.id ? 'border-red-500 opacity-50' : 'border-white/10'
              }`}
            >
              <GripVertical aria-hidden="true" className="h-5 w-5 shrink-0 cursor-grab text-zinc-500" />
              <span className="w-7 shrink-0 text-center text-xs font-bold text-zinc-500">{index + 1}</span>
              <div className="flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-900">
                {motor.image ? <img src={motor.image} alt="" className="h-full w-full object-contain" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{motor.name}</p>
                <p className="mt-0.5 truncate text-xs text-zinc-400">{motor.category} · {formatRupiah(motor.numericPrice || motor.price)}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label={`Naikkan ${motor.name}`}
                  disabled={index === 0}
                  onClick={() => moveMotor(motor.id, index - 1)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Turunkan ${motor.name}`}
                  disabled={index === orderedMotors.length - 1}
                  onClick={() => moveMotor(motor.id, index + 1)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-zinc-400">
          Belum ada motor pada katalog.
        </p>
      )}
    </section>
  );
}

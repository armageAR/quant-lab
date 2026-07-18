'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';

import { InfoIcon } from './icons';
import { Modal } from './modal';

export function InfoButton({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="button secondary"
        onClick={() => setOpen(true)}
        type="button"
      >
        <InfoIcon /> Cómo leer esta pantalla
      </button>
      <Modal onClose={() => setOpen(false)} open={open} title={title}>
        {children}
      </Modal>
    </>
  );
}

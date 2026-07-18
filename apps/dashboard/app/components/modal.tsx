'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

import { CloseIcon } from './icons';

interface ModalProps {
  children: ReactNode;
  open: boolean;
  title: string;
  onClose: () => void;
}

export function Modal({ children, open, title, onClose }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog className="modal" onClose={onClose} ref={ref}>
      <div className="modal-head">
        <div>
          <span className="overline">CONSULTA RÁPIDA</span>
          <h2>{title}</h2>
        </div>
        <button
          aria-label="Cerrar"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

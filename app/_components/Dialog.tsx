"use client";

import { ReactNode, useEffect, useRef } from "react";
import styles from "./Dialog.module.css";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export const Dialog = ({ open, title, onClose, children }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-label={title} onClose={onClose}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </dialog>
  );
};

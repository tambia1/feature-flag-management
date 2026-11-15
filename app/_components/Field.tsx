import { ReactNode } from "react";
import styles from "./Field.module.css";

type Props = {
  label: string;
  className?: string;
  children: ReactNode;
};

export const Field = ({ label, className = "", children }: Props) => {
  return (
    <label className={`${styles.field} ${className}`}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
};

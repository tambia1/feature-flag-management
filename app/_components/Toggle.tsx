import { ComponentProps } from "react";
import styles from "./Toggle.module.css";

type Props = Omit<ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  label: string;
};

export const Toggle = ({ checked, label, className = "", type = "button", ...props }: Props) => {
  return (
    <button type={type} role="switch" aria-checked={checked} aria-label={label} className={`${styles.toggle} ${className}`} {...props}>
      <span className={styles.thumb} />
    </button>
  );
};

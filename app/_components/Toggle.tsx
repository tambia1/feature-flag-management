import { ComponentProps } from "react";
import styles from "./Toggle.module.css";

type Props = Omit<ComponentProps<"button">, "onChange"> & {
  checked: boolean;
  label: string;
  danger?: boolean;
};

/** An on/off switch. `label` names it for screen readers. */
export const Toggle = ({ checked, label, danger = false, className = "", type = "button", ...props }: Props) => {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`${styles.toggle} ${danger ? styles.danger : ""} ${className}`}
      {...props}
    >
      <span className={styles.thumb} />
    </button>
  );
};

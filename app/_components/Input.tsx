import { ComponentProps } from "react";
import styles from "./Input.module.css";

type Props = ComponentProps<"input"> & {
  compact?: boolean;
};

export const Input = ({ compact = false, className = "", ...props }: Props) => {
  return <input className={`${styles.input} ${compact ? styles.compact : ""} ${className}`} {...props} />;
};

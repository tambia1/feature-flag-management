import { ComponentProps } from "react";
import styles from "./Select.module.css";

type Props = ComponentProps<"select"> & {
  compact?: boolean;
  options: { value: string; label: string }[];
};

export const Select = ({ compact = false, options, className = "", ...props }: Props) => {
  return (
    <select className={`${styles.select} ${compact ? styles.compact : ""} ${className}`} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

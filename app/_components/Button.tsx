import { ComponentProps } from "react";
import styles from "./Button.module.css";

type Props = ComponentProps<"button"> & {
  variant: "primary" | "secondary" | "danger" | "link";
  icon?: boolean;
};

export const Button = ({ variant, icon = false, className = "", type = "button", ...props }: Props) => {
  return <button type={type} className={`${styles.button} ${styles[variant]} ${icon ? styles.icon : ""} ${className}`} {...props} />;
};

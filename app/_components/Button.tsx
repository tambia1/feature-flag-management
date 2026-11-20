import { ComponentProps } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "solid" | "outline" | "link" | "plain";
export type ButtonColor = "accent" | "neutral" | "danger" | "success";

type Props = ComponentProps<"button"> & {
  variant: ButtonVariant;
  color?: ButtonColor;
  icon?: boolean;
};

export const Button = ({ variant, color = "accent", icon = false, className = "", type = "button", ...props }: Props) => {
  return (
    <button
      type={type}
      className={`${styles.button} ${styles[variant]} ${styles[color]} ${icon ? styles.icon : ""} ${className}`}
      {...props}
    />
  );
};

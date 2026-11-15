import { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type Props = {
  icon: string;
  title: string;
  text: string;
  children?: ReactNode;
};

export const EmptyState = ({ icon, title, text, children }: Props) => {
  return (
    <div className={styles.emptyState}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{text}</p>
      {children}
    </div>
  );
};

import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import styles from "./EmptyState.module.css";

type Props = {
  icon: LucideIcon;
  title: string;
  text: string;
  children?: ReactNode;
};

export const EmptyState = ({ icon: Icon, title, text, children }: Props) => {
  return (
    <div className={styles.emptyState}>
      <Icon size={32} strokeWidth={1.5} className={styles.icon} />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{text}</p>
      {children}
    </div>
  );
};

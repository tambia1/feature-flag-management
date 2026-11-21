import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import styles from "./EmptyState.module.css";
import { Text } from "./Text";

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
      <Text variant="heading">{title}</Text>
      <Text variant="body" color="muted" className={styles.text}>
        {text}
      </Text>
      {children}
    </div>
  );
};

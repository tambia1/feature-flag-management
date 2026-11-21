import { ReactNode } from "react";
import styles from "./Page.module.css";
import { Text } from "@/app/_components/Text";

type Props = {
  title: string;
  icon?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

export const Page = ({ title, icon, subtitle, actions, children }: Props) => {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.heading}>
          {icon}
          <div>
            <Text variant="title">{title}</Text>
            {subtitle && (
              <Text variant="body" color="muted">
                {subtitle}
              </Text>
            )}
          </div>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </div>
  );
};

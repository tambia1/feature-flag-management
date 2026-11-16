import { ReactNode } from "react";
import styles from "./Page.module.css";

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
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {children}
    </div>
  );
};

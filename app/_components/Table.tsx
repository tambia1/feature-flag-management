import { ReactNode } from "react";
import styles from "./Table.module.css";

type Props = {
  headers: string[];
  isEmpty?: boolean;
  emptyText?: string;
  editable?: boolean;
  className?: string;
  children: ReactNode;
};

export const Table = ({ headers, isEmpty = false, emptyText = "Nothing here yet.", editable = false, className = "", children }: Props) => {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <table className={styles.table}>
        <thead className={styles.head}>
          <tr>
            {headers.map((header, index) => (
              <th key={index} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={`${styles.body} ${editable ? styles.editable : ""}`}>
          {isEmpty ? (
            <tr>
              <td colSpan={headers.length} className={styles.empty}>
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
};

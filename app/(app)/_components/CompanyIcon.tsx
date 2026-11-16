import Image from "next/image";
import styles from "./CompanyIcon.module.css";

type Props = {
  name: string;
  url: string | null;
  size: "small" | "large";
};

const PIXELS = { small: 24, large: 64 };

export const CompanyIcon = ({ name, url, size }: Props) => {
  if (!url) {
    return (
      <span className={`${styles.icon} ${styles.fallback} ${styles[size]}`} aria-hidden="true">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return <Image src={url} alt="" width={PIXELS[size]} height={PIXELS[size]} unoptimized className={`${styles.icon} ${styles[size]}`} />;
};

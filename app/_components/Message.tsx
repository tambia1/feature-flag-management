import styles from "./Message.module.css";

type Props = {
  text?: string;
  state?: "success" | "error" | "normal";
  className?: string;
};

/** A one-line status message. Renders nothing without text. Announced to screen readers. */
export const Message = ({ text, state = "normal", className = "" }: Props) => {
  if (!text) {
    return null;
  }

  return (
    <p role={state === "error" ? "alert" : "status"} className={`${styles.message} ${styles[state]} ${className}`}>
      {text}
    </p>
  );
};

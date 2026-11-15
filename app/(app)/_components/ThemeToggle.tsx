"use client";

type Props = {
  className?: string;
};

export const ThemeToggle = ({ className = "" }: Props) => {
  const toggle = () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);

    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  };

  return (
    <button type="button" className={className} onClick={toggle}>
      Light / dark theme
    </button>
  );
};

"use client";

import { Button } from "@/app/_components/Button";

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
    <Button variant="plain" className={className} onClick={toggle}>
      Light / Dark theme
    </Button>
  );
};

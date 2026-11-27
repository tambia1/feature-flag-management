"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  active: boolean;
  intervalMs: number;
};

export const RefreshWhile = ({ active, intervalMs }: Props) => {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return null;
};

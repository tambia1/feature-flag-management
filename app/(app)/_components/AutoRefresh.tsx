"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/app/_components/Button";
import styles from "./AutoRefresh.module.css";

type Props = {
  intervalMs: number;
};

const FLIP_MS = 400;

const restart = (element: Element | null, keyframes: Keyframe[], duration: number) => {
  element?.getAnimations().forEach((animation) => animation.cancel());
  element?.animate(keyframes, { duration, easing: "linear", fill: "forwards" });
};

export const AutoRefresh = ({ intervalMs }: Props) => {
  const router = useRouter();
  const glass = useRef<SVGSVGElement>(null);
  const topSand = useRef<SVGPolygonElement>(null);
  const bottomSand = useRef<SVGPolygonElement>(null);
  const nextAt = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState(Math.round(intervalMs / 1000));

  const startCycle = useCallback(() => {
    nextAt.current = Date.now() + intervalMs;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    glass.current?.animate([{ transform: "rotate(180deg)" }, { transform: "rotate(0deg)" }], { duration: FLIP_MS, easing: "ease-out" });
    restart(topSand.current, [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], intervalMs);
    restart(bottomSand.current, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], intervalMs);
  }, [intervalMs]);

  const refreshNow = useCallback(() => {
    router.refresh();
    setSecondsLeft(Math.round(intervalMs / 1000));
    startCycle();
  }, [router, intervalMs, startCycle]);

  useEffect(() => {
    startCycle();

    const timer = setInterval(() => {
      const left = Math.ceil((nextAt.current - Date.now()) / 1000);

      if (left > 0) {
        setSecondsLeft(left);
        return;
      }

      refreshNow();
    }, 250);

    return () => clearInterval(timer);
  }, [startCycle, refreshNow]);

  return (
    <Button variant="plain" onClick={refreshNow} title="Refresh now">
      <span className={styles.refresh}>
        <svg ref={glass} className={styles.glass} viewBox="0 0 24 24" aria-hidden="true">
          <polygon ref={topSand} className={styles.topSand} points="8.5,5 15.5,5 12,10.5" />
          <line className={styles.stream} x1="12" y1="11" x2="12" y2="19.5" />
          <polygon ref={bottomSand} className={styles.bottomSand} points="8,20 16,20 12,15" />
          <path className={styles.frame} d="M5 3h14M5 21h14M7 3c0 5 5 6 5 9 0-3 5-4 5-9M7 21c0-5 5-6 5-9 0 3 5 4 5 9" />
        </svg>
        <span className={styles.label}>
          Next update in <span className={styles.seconds}>{secondsLeft}</span>s
        </span>
      </span>
    </Button>
  );
};

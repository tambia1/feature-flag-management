"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityKey, CompanyActivity } from "@/app/types";
import styles from "./ActivityChart.module.css";

type Props = {
  activity: CompanyActivity;
};

const HEIGHT = 280;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 40 };

const niceTicks = (max: number): number[] => {
  const rough = Math.max(max, 1) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? rough;
  const top = Math.max(step, Math.ceil(Math.max(max, 1) / step) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
};

export const ActivityChart = ({ activity }: Props) => {
  const [shown, setShown] = useState<ActivityKey[]>(activity.series.map((series) => series.key));
  const [hovered, setHovered] = useState<number | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visible = activity.series.filter((series) => shown.includes(series.key));
  const ticks = niceTicks(Math.max(0, ...visible.flatMap((series) => series.values)));
  const top = ticks.at(-1) ?? 1;
  const plotWidth = Math.max(0, (width ?? 0) - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const last = activity.months.length - 1;
  const x = (index: number) => MARGIN.left + (last > 0 ? (index / last) * plotWidth : plotWidth / 2);
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const labelEvery = (width ?? 0) < 520 ? 3 : (width ?? 0) < 760 ? 2 : 1;

  const toggle = (key: ActivityKey) => setShown(shown.includes(key) ? shown.filter((item) => item !== key) : [...shown, key]);

  const hoverAt = (clientX: number, element: SVGRectElement) => {
    const left = element.getBoundingClientRect().left;
    const ratio = last > 0 ? (clientX - left) / plotWidth : 0;
    setHovered(Math.min(last, Math.max(0, Math.round(ratio * last))));
  };

  return (
    <div className={styles.chart}>
      <fieldset className={styles.legend}>
        <legend className={styles.legendTitle}>Show</legend>
        {activity.series.map((series) => (
          <label key={series.key} className={`${styles.option} ${styles[series.key]}`}>
            <input type="checkbox" checked={shown.includes(series.key)} onChange={() => toggle(series.key)} />
            <span className={styles.swatch} aria-hidden="true" />
            {series.label}
            <span className={styles.latest}>{series.values.at(-1)}</span>
          </label>
        ))}
      </fieldset>

      <div ref={frame} className={styles.frame}>
        {visible.length === 0 ? (
          <p className={styles.empty}>Pick at least one to show.</p>
        ) : width === null ? (
          <div className={styles.placeholder} />
        ) : (
          <svg
            width={width}
            height={HEIGHT}
            className={styles.svg}
            role="img"
            aria-label={`${visible.map((series) => series.label).join(", ")} per month, ${activity.months[0]} to ${activity.months[last]}`}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={MARGIN.left + plotWidth}
                  y1={y(tick)}
                  y2={y(tick)}
                  className={tick === 0 ? styles.baseline : styles.grid}
                />
                <text x={MARGIN.left - 8} y={y(tick)} className={styles.yLabel}>
                  {tick}
                </text>
              </g>
            ))}
            {activity.months.map((month, index) =>
              index % labelEvery === last % labelEvery ? (
                <text key={month} x={x(index)} y={HEIGHT - 8} className={styles.xLabel}>
                  {month.split(" ")[0]}
                </text>
              ) : null,
            )}
            {hovered !== null && (
              <line x1={x(hovered)} x2={x(hovered)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} className={styles.crosshair} />
            )}
            {visible.map((series) => (
              <path
                key={series.key}
                d={series.values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(value)}`).join(" ")}
                className={`${styles.line} ${styles[series.key]}`}
              />
            ))}
            {hovered !== null &&
              visible.map((series) => (
                <circle
                  key={series.key}
                  cx={x(hovered)}
                  cy={y(series.values[hovered])}
                  r={4}
                  className={`${styles.dot} ${styles[series.key]}`}
                />
              ))}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={plotWidth}
              height={plotHeight}
              className={styles.hitArea}
              onPointerMove={(event) => hoverAt(event.clientX, event.currentTarget)}
              onPointerLeave={() => setHovered(null)}
            />
          </svg>
        )}
        {hovered !== null && visible.length > 0 && (
          <div className={`${styles.tooltip} ${hovered > last / 2 ? styles.tooltipLeft : styles.tooltipRight}`}>
            <p className={styles.tooltipTitle}>{activity.months[hovered]}</p>
            {visible.map((series) => (
              <p key={series.key} className={`${styles.tooltipRow} ${styles[series.key]}`}>
                <span className={styles.swatch} aria-hidden="true" />
                {series.label}
                <span className={styles.tooltipValue}>{series.values[hovered]}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <details className={styles.data}>
        <summary>Show as table</summary>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Month</th>
                {activity.series.map((series) => (
                  <th key={series.key} scope="col">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.months.map((month, index) => (
                <tr key={month}>
                  <th scope="row">{month}</th>
                  {activity.series.map((series) => (
                    <td key={series.key}>{series.values[index]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};

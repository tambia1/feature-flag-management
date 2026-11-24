"use client";

import { useRef } from "react";
import type { Serve, Variation } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Input } from "@/app/_components/Input";
import { Select } from "@/app/_components/Select";
import { formatValue } from "@/lib/flags/values";
import styles from "./ServeEditor.module.css";
import { Text } from "@/app/_components/Text";

type Props = {
  serve: Serve;
  variations: Variation[];
  onChange: (serve: Serve) => void;
};

const ROLLOUT = "__rollout";

const toPercent = (text: string) => Math.max(0, Math.min(100, Math.round(Number(text) || 0)));

const sum = (numbers: number[]) => numbers.reduce((total, number) => total + number, 0);

const EPSILON = 1e-9;

const spread = (weights: number[], change: number): number[] => {
  const result = [...weights];
  let remaining = change;

  while (Math.abs(remaining) > EPSILON) {
    const open = result.flatMap((weight, index) => (remaining > 0 || weight > EPSILON ? [index] : []));
    if (open.length === 0) break;

    const share = remaining / open.length;
    for (const index of open) {
      const applied = Math.max(share, -result[index]);
      result[index] += applied;
      remaining -= applied;
    }
  }

  return result;
};

const toWholeNumbers = (exact: number[], total: number, firstMovesFirst: boolean): number[] => {
  const result = exact.map((value) => Math.floor(value + EPSILON));
  const order = exact
    .map((value, index) => ({ index, remainder: value - result[index] }))
    .sort((a, b) =>
      Math.abs(a.remainder - b.remainder) > EPSILON ? b.remainder - a.remainder : firstMovesFirst ? a.index - b.index : b.index - a.index,
    );
  for (const { index } of order.slice(0, Math.max(0, total - sum(result)))) {
    result[index] += 1;
  }
  return result;
};

export const ServeEditor = ({ serve, variations, onChange }: Props) => {
  const isRollout = "rollout" in serve;
  const weightOf = (id: string) => (isRollout ? (serve.rollout.find((part) => part.variationId === id)?.weight ?? 0) : 0);
  const weights = variations.map((variation) => weightOf(variation.id));
  const total = sum(weights);
  const exactWeights = useRef<{ exact: number[]; whole: number[] } | null>(null);

  const setWeights = (next: number[]) =>
    onChange({ rollout: variations.map((variation, index) => ({ variationId: variation.id, weight: next[index] })) });

  const splitEvenly = () => {
    exactWeights.current = null;
    setWeights(toWholeNumbers(Array(variations.length).fill(100 / variations.length), 100, true));
  };

  const move = (index: number, wanted: number) => {
    const saved = exactWeights.current;
    const current = saved && saved.whole.join() === weights.join() ? saved.exact : weights;
    const isLast = index === weights.length - 1;
    const fixed = isLast ? [] : weights.slice(0, index);
    const available = Math.max(0, 100 - sum(fixed));
    const kept = Math.min(wanted, available);
    const others = isLast ? [...current.slice(0, index)].reverse() : current.slice(index + 1);
    const change = available - kept - sum(others);
    const exactOthers = spread(others, change);
    const wholeOthers = toWholeNumbers(exactOthers, available - kept, change >= 0);
    const place = (moved: number[]) => (isLast ? [...[...moved].reverse(), kept] : [...fixed, kept, ...moved]);

    exactWeights.current = { exact: place(exactOthers), whole: place(wholeOthers) };
    setWeights(place(wholeOthers));
  };

  const choose = (value: string) => (value === ROLLOUT ? splitEvenly() : onChange({ variationId: value }));

  return (
    <div className={styles.serve}>
      <Select
        compact
        aria-label="Serve"
        value={isRollout ? ROLLOUT : serve.variationId}
        onChange={(event) => choose(event.target.value)}
        options={[
          ...variations.map((variation) => ({ value: variation.id, label: formatValue(variation.value) })),
          { value: ROLLOUT, label: "a percentage rollout" },
        ]}
      />
      {isRollout && (
        <div className={styles.rollout}>
          <div className={styles.parts}>
            {variations.map((variation, index) => {
              const label = formatValue(variation.value);
              const weight = weights[index];
              const setWeight = (text: string) => move(index, toPercent(text));
              return (
                <div key={variation.id} className={styles.part}>
                  <span className={styles.value}>{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={weight}
                    className={styles.slider}
                    aria-label={`Percent for ${label}`}
                    aria-valuetext={`${weight}%`}
                    onChange={(event) => setWeight(event.target.value)}
                  />
                  <span className={styles.percent}>
                    <Input
                      compact
                      type="number"
                      min={0}
                      max={100}
                      value={weight}
                      className={styles.weight}
                      aria-label={`Percent for ${label}, typed`}
                      onChange={(event) => setWeight(event.target.value)}
                    />
                    %
                  </span>
                </div>
              );
            })}
          </div>
          <div className={styles.footer}>
            <Text variant="small" as="span" color={total === 100 ? "muted" : "danger"} aria-live="polite">
              Total {total}%{total !== 100 && " — must be 100%"}
            </Text>
            <Button variant="link" onClick={splitEvenly}>
              Split evenly
            </Button>
          </div>
          <Text variant="small" color="muted">
            Each user is placed by their context key, so they keep getting the same value every time, as long as your app sends the same
            key. Changing the percentages can move some users to another value.
          </Text>
        </div>
      )}
    </div>
  );
};

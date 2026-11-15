"use client";

import type { Serve, Variation } from "@/app/types";
import { Input } from "@/app/_components/Input";
import { Select } from "@/app/_components/Select";
import { formatValue } from "@/lib/flags/values";
import styles from "./ServeEditor.module.css";

type Props = {
  serve: Serve;
  variations: Variation[];
  onChange: (serve: Serve) => void;
};

const ROLLOUT = "__rollout";

/** Serve one variation, or a percentage rollout across variations. */
export const ServeEditor = ({ serve, variations, onChange }: Props) => {
  const isRollout = "rollout" in serve;
  const total = isRollout ? serve.rollout.reduce((sum, part) => sum + part.weight, 0) : 100;

  const choose = (value: string) => {
    if (value === ROLLOUT) {
      onChange({ rollout: variations.map((variation, index) => ({ variationId: variation.id, weight: index === 0 ? 100 : 0 })) });
    } else {
      onChange({ variationId: value });
    }
  };

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
          {variations.map((variation) => {
            const weight = serve.rollout.find((part) => part.variationId === variation.id)?.weight ?? 0;
            return (
              <label key={variation.id} className={styles.part}>
                <Input
                  compact
                  type="number"
                  min={0}
                  max={100}
                  value={weight}
                  className={styles.weight}
                  aria-label={`Percent for ${formatValue(variation.value)}`}
                  onChange={(event) =>
                    onChange({
                      rollout: variations.map((item) => ({
                        variationId: item.id,
                        weight:
                          item.id === variation.id
                            ? Math.max(0, Math.min(100, Math.round(Number(event.target.value) || 0)))
                            : (serve.rollout.find((part) => part.variationId === item.id)?.weight ?? 0),
                      })),
                    })
                  }
                />
                % {formatValue(variation.value)}
              </label>
            );
          })}
          {total !== 100 && <span className={styles.error}>Adds up to {total}% — must be 100%</span>}
        </div>
      )}
    </div>
  );
};

"use client";

import { useActionState, useState } from "react";
import type { Clause, ClauseOperator, Rule, Serve, Target, Variation } from "@/app/types";
import { Button } from "@/app/_components/Button";
import { Dialog } from "@/app/_components/Dialog";
import { Field } from "@/app/_components/Field";
import { Input } from "@/app/_components/Input";
import { Message } from "@/app/_components/Message";
import { Select } from "@/app/_components/Select";
import { OPERATOR_LABELS } from "@/lib/flags/describe";
import { formatValue } from "@/lib/flags/values";
import { saveTargeting } from "../../actions";
import { ServeEditor } from "./ServeEditor";
import styles from "./TargetingEditor.module.css";

type Settings = {
  offVariationId: string;
  targets: Target[];
  rules: Rule[];
};

type Props = {
  flagId: string;
  environmentId: string;
  variations: Variation[];
  initial: Settings;
  canEdit: boolean;
};

const OPERATORS = (Object.keys(OPERATOR_LABELS) as ClauseOperator[]).map((value) => ({ value, label: OPERATOR_LABELS[value] }));
const splitList = (text: string) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const newId = () => crypto.randomUUID().slice(0, 8);

export const TargetingEditor = ({ flagId, environmentId, variations, initial, canEdit }: Props) => {
  const [state, formAction, isPending] = useActionState(saveTargeting, {});
  const [confirming, setConfirming] = useState(false);

  const [offVariationId, setOffVariationId] = useState(initial.offVariationId);
  const [targetText, setTargetText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      variations.map((variation) => [
        variation.id,
        initial.targets.find((target) => target.variationId === variation.id)?.keys.join(", ") ?? "",
      ]),
    ),
  );
  const [rules, setRules] = useState<Rule[]>(initial.rules.slice(0, -1));
  const [defaultServe, setDefaultServe] = useState<Serve>(initial.rules.at(-1)?.serve ?? { variationId: variations[0].id });

  const targets: Target[] = variations
    .map((variation) => ({ variationId: variation.id, keys: splitList(targetText[variation.id] ?? "") }))
    .filter((target) => target.keys.length > 0);
  const targeting = { offVariationId, targets, rules: [...rules, { id: "default", clauses: [], serve: defaultServe }] };
  const isDirty =
    JSON.stringify(targeting) !==
    JSON.stringify({
      offVariationId: initial.offVariationId,
      targets: initial.targets.filter((target) => target.keys.length > 0),
      rules: initial.rules,
    });

  const reset = () => {
    setOffVariationId(initial.offVariationId);
    setTargetText(
      Object.fromEntries(
        variations.map((variation) => [
          variation.id,
          initial.targets.find((target) => target.variationId === variation.id)?.keys.join(", ") ?? "",
        ]),
      ),
    );
    setRules(initial.rules.slice(0, -1));
    setDefaultServe(initial.rules.at(-1)?.serve ?? { variationId: variations[0].id });
  };

  const updateRule = (index: number, rule: Rule) => setRules(rules.map((item, i) => (i === index ? rule : item)));
  const updateClause = (ruleIndex: number, clauseIndex: number, clause: Clause) =>
    updateRule(ruleIndex, { ...rules[ruleIndex], clauses: rules[ruleIndex].clauses.map((item, i) => (i === clauseIndex ? clause : item)) });
  const moveRule = (index: number, by: -1 | 1) => {
    const next = [...rules];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    setRules(next);
  };

  return (
    <form action={formAction} className={styles.editor}>
      <input type="hidden" name="flagId" value={flagId} />
      <input type="hidden" name="environmentId" value={environmentId} />
      <input type="hidden" name="targeting" value={JSON.stringify(targeting)} />

      <fieldset className={styles.section} disabled={!canEdit}>
        <legend className={styles.legend}>Individual targets</legend>
        <p className={styles.help}>These user keys always get this value. Separate keys with commas.</p>
        {variations.map((variation) => (
          <label key={variation.id} className={styles.targetRow}>
            <span className={styles.value}>{formatValue(variation.value)}</span>
            <span aria-hidden="true">→</span>
            <Input
              compact
              placeholder="user-12, user-99"
              value={targetText[variation.id] ?? ""}
              onChange={(event) => setTargetText({ ...targetText, [variation.id]: event.target.value })}
              aria-label={`User keys that get ${formatValue(variation.value)}`}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.section} disabled={!canEdit}>
        <legend className={styles.legend}>Rules (checked top to bottom)</legend>
        {rules.length === 0 && <p className={styles.help}>No rules yet. Everyone gets the default rule.</p>}
        <ol className={styles.rules}>
          {rules.map((rule, ruleIndex) => (
            <li key={rule.id} className={styles.rule}>
              <div className={styles.ruleHead}>
                <span className={styles.ruleNumber}>{ruleIndex + 1}.</span>
                <div className={styles.ruleTools}>
                  <Button
                    variant="link"
                    onClick={() => moveRule(ruleIndex, -1)}
                    disabled={ruleIndex === 0}
                    aria-label={`Move rule ${ruleIndex + 1} up`}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="link"
                    onClick={() => moveRule(ruleIndex, 1)}
                    disabled={ruleIndex === rules.length - 1}
                    aria-label={`Move rule ${ruleIndex + 1} down`}
                  >
                    ↓
                  </Button>
                  <Button variant="link" onClick={() => setRules(rules.filter((_, i) => i !== ruleIndex))}>
                    Remove rule
                  </Button>
                </div>
              </div>
              {rule.clauses.map((clause, clauseIndex) => (
                <div key={clauseIndex} className={styles.clause}>
                  <span className={styles.joiner}>{clauseIndex === 0 ? "IF" : "AND"}</span>
                  <Input
                    compact
                    placeholder="attribute, e.g. country"
                    aria-label="Attribute"
                    value={clause.attribute}
                    onChange={(event) => updateClause(ruleIndex, clauseIndex, { ...clause, attribute: event.target.value })}
                  />
                  <Select
                    compact
                    aria-label="Operator"
                    value={clause.operator}
                    options={OPERATORS}
                    onChange={(event) =>
                      updateClause(ruleIndex, clauseIndex, { ...clause, operator: event.target.value as ClauseOperator })
                    }
                  />
                  <Input
                    compact
                    placeholder="values, comma separated"
                    aria-label="Values"
                    defaultValue={clause.values.join(", ")}
                    onChange={(event) => updateClause(ruleIndex, clauseIndex, { ...clause, values: splitList(event.target.value) })}
                  />
                  <Button
                    variant="link"
                    aria-label="Remove condition"
                    disabled={rule.clauses.length === 1}
                    onClick={() => updateRule(ruleIndex, { ...rule, clauses: rule.clauses.filter((_, i) => i !== clauseIndex) })}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button
                variant="link"
                onClick={() =>
                  updateRule(ruleIndex, { ...rule, clauses: [...rule.clauses, { attribute: "", operator: "is", values: [] }] })
                }
              >
                + AND condition
              </Button>
              <div className={styles.serve}>
                <span>Serve</span>
                <ServeEditor serve={rule.serve} variations={variations} onChange={(serve) => updateRule(ruleIndex, { ...rule, serve })} />
              </div>
            </li>
          ))}
        </ol>
        <Button
          variant="secondary"
          onClick={() =>
            setRules([
              ...rules,
              { id: newId(), clauses: [{ attribute: "", operator: "is", values: [] }], serve: { variationId: variations[0].id } },
            ])
          }
        >
          + Add rule
        </Button>
      </fieldset>

      <fieldset className={styles.section} disabled={!canEdit}>
        <legend className={styles.legend}>Default rule</legend>
        <p className={styles.help}>
          Everyone who doesn&apos;t match a target or rule, while the flag is on. A rollout splits users by their key.
        </p>
        <ServeEditor serve={defaultServe} variations={variations} onChange={setDefaultServe} />
      </fieldset>

      <fieldset className={styles.section} disabled={!canEdit}>
        <legend className={styles.legend}>Off value</legend>
        <p className={styles.help}>Everyone gets this value while the flag is off or archived.</p>
        <Select
          aria-label="Off value"
          value={offVariationId}
          onChange={(event) => setOffVariationId(event.target.value)}
          options={variations.map((variation) => ({ value: variation.id, label: formatValue(variation.value) }))}
        />
      </fieldset>

      <Message text={state.error} state="error" />
      <Message text={!isDirty ? state.success : undefined} state="success" />

      {canEdit && (
        <div className={styles.actions}>
          <Button variant="primary" disabled={!isDirty || isPending} onClick={() => setConfirming(true)}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="secondary" disabled={!isDirty || isPending} onClick={reset}>
            Cancel
          </Button>
        </div>
      )}

      <Dialog open={confirming} title="Save changes?" onClose={() => setConfirming(false)}>
        <div className={styles.dialog}>
          <Field label="Comment (saved to the log)">
            <Input name="comment" maxLength={500} placeholder="e.g. Start rollout" />
          </Field>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" onClick={() => setConfirming(false)}>
              Save changes
            </Button>
          </div>
        </div>
      </Dialog>
    </form>
  );
};

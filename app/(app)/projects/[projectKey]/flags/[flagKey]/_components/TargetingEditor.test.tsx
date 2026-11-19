// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Rule, Variation } from "@/app/types";
import { TargetingEditor } from "./TargetingEditor";

vi.mock("../../actions", () => ({ saveTargeting: async () => ({}) }));

afterEach(cleanup);

const variations: Variation[] = [
  { id: "on", value: true, order: 0 },
  { id: "off", value: false, order: 1 },
];

const defaultRule: Rule = { id: "default", clauses: [], serve: { variationId: "on" } };

const rule = (id: string, attribute: string): Rule => ({
  id,
  clauses: [{ attribute, operator: "is", values: ["x"] }],
  serve: { variationId: "on" },
});

const renderEditor = (rules: Rule[] = [defaultRule], canEdit = true) =>
  render(
    <TargetingEditor
      flagId="flag-1"
      environmentId="env-1"
      variations={variations}
      initial={{ offVariationId: "off", rules }}
      canEdit={canEdit}
    />,
  );

const submitted = () =>
  JSON.parse((document.querySelector('input[name="targeting"]') as HTMLInputElement).value) as { offVariationId: string; rules: Rule[] };

const button = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("TargetingEditor", () => {
  it("starts with no rules and nothing to save", () => {
    renderEditor();

    expect(screen.getByText("No rules yet. Everyone gets the default rule.")).toBeTruthy();
    expect(button("Save changes").disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
  });

  it("adds a rule above the default rule and builds its condition", () => {
    renderEditor();

    fireEvent.click(button("Add rule"));
    fireEvent.change(screen.getByRole("textbox", { name: "Attribute" }), { target: { value: "country" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Operator" }), { target: { value: "isNot" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Values" }), { target: { value: "DE, FR,, " } });

    const { rules } = submitted();
    expect(rules).toHaveLength(2);
    expect(rules[0].clauses).toEqual([{ attribute: "country", operator: "isNot", values: ["DE", "FR"] }]);
    expect(rules[1]).toEqual(defaultRule);
    expect(button("Save changes").disabled).toBe(false);
  });

  it("joins extra conditions with AND and keeps at least one", () => {
    renderEditor([rule("r1", "plan"), defaultRule]);

    expect((screen.getByRole("button", { name: "Remove condition" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(button("AND condition"));
    expect(screen.getByText("AND")).toBeTruthy();
    expect(submitted().rules[0].clauses).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove condition" })[1]);
    expect(submitted().rules[0].clauses).toEqual(rule("r1", "plan").clauses);
  });

  it("moves rules up and down, but never past the ends", () => {
    renderEditor([rule("r1", "plan"), rule("r2", "country"), defaultRule]);

    expect(button("Move rule 1 up").disabled).toBe(true);
    expect(button("Move rule 2 down").disabled).toBe(true);

    fireEvent.click(button("Move rule 2 up"));
    expect(submitted().rules.map((item) => item.id)).toEqual(["r2", "r1", "default"]);
  });

  it("removes a rule", () => {
    renderEditor([rule("r1", "plan"), rule("r2", "country"), defaultRule]);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove rule" })[0]);
    expect(submitted().rules.map((item) => item.id)).toEqual(["r2", "default"]);
  });

  it("changes the off value", () => {
    renderEditor();

    fireEvent.change(screen.getByRole("combobox", { name: "Off value" }), { target: { value: "on" } });
    expect(submitted().offVariationId).toBe("on");
  });

  it("puts everything back on Cancel", () => {
    renderEditor([rule("r1", "plan"), defaultRule]);

    fireEvent.click(button("Remove rule"));
    fireEvent.change(screen.getByRole("combobox", { name: "Off value" }), { target: { value: "on" } });
    fireEvent.click(button("Cancel"));

    expect(submitted()).toEqual({ offVariationId: "off", rules: [rule("r1", "plan"), defaultRule] });
    expect(button("Save changes").disabled).toBe(true);
  });

  it("is read-only for a viewer", () => {
    renderEditor([rule("r1", "plan"), defaultRule], false);

    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect((screen.getByRole("textbox", { name: "Attribute" }) as HTMLInputElement).matches(":disabled")).toBe(true);
    expect((screen.getByRole("combobox", { name: "Off value" }) as HTMLSelectElement).matches(":disabled")).toBe(true);
  });
});

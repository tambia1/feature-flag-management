// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Toggle } from "./Toggle";

afterEach(cleanup);

describe("Toggle", () => {
  it("is a named switch that reports its state", () => {
    render(<Toggle checked label="new-checkout in production" />);
    const toggle = screen.getByRole("switch", { name: "new-checkout in production" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("does not fire when disabled", () => {
    const onClick = vi.fn<() => void>();
    render(<Toggle checked={false} label="flag" disabled onClick={onClick} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onClick).not.toHaveBeenCalled();
  });
});

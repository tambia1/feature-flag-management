// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Serve, Variation } from "@/app/types";
import { ServeEditor } from "./ServeEditor";

afterEach(cleanup);

const variations = (...values: string[]): Variation[] => values.map((value, order) => ({ id: `v${order}`, value, order }));

const rollout = (...weights: number[]): Serve => ({ rollout: weights.map((weight, index) => ({ variationId: `v${index}`, weight })) });

const Editor = ({ start, values }: { start: Serve; values: Variation[] }) => {
  const [serve, setServe] = useState(start);
  return <ServeEditor serve={serve} variations={values} onChange={setServe} />;
};

const percents = () => screen.getAllByRole("spinbutton").map((input) => Number((input as HTMLInputElement).value));

describe("ServeEditor", () => {
  it("explains that users keep their value only for a rollout", () => {
    const note = /keep getting the same value/;
    const { rerender } = render(<ServeEditor serve={{ variationId: "v0" }} variations={variations("a", "b")} onChange={() => {}} />);

    expect(screen.queryByText(note)).toBeNull();

    rerender(<ServeEditor serve={rollout(50, 50)} variations={variations("a", "b")} onChange={() => {}} />);

    expect(screen.getByText(note)).toBeTruthy();
  });

  it("shows a slider and a percent box for every value", () => {
    render(<ServeEditor serve={rollout(25, 25, 25, 25)} variations={variations("a", "b", "c", "d")} onChange={() => {}} />);

    expect(screen.getAllByRole("slider")).toHaveLength(4);
    expect(screen.getAllByRole("spinbutton")).toHaveLength(4);
    expect(screen.getByText("Total 100%")).toBeTruthy();
  });

  it("keeps the rows above and shares the change equally between the rows below", () => {
    const onChange = vi.fn<(serve: Serve) => void>();
    render(<ServeEditor serve={rollout(25, 25, 25, 25)} variations={variations("a", "b", "c", "d")} onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider", { name: "Percent for a" }), { target: { value: "40" } });
    expect(onChange).toHaveBeenLastCalledWith(rollout(40, 20, 20, 20));

    fireEvent.change(screen.getByRole("slider", { name: "Percent for b" }), { target: { value: "45" } });
    expect(onChange).toHaveBeenLastCalledWith(rollout(25, 45, 15, 15));
  });

  it("moves every row below by the same amount", () => {
    const onChange = vi.fn<(serve: Serve) => void>();
    render(<ServeEditor serve={rollout(40, 40, 15, 5)} variations={variations("a", "b", "c", "d")} onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider", { name: "Percent for b" }), { target: { value: "20" } });
    expect(onChange).toHaveBeenLastCalledWith(rollout(40, 20, 25, 15));
  });

  it("takes what a row at 0 can't give from the others", () => {
    const onChange = vi.fn<(serve: Serve) => void>();
    render(<ServeEditor serve={rollout(40, 40, 18, 2)} variations={variations("a", "b", "c", "d")} onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider", { name: "Percent for b" }), { target: { value: "50" } });
    expect(onChange).toHaveBeenLastCalledWith(rollout(40, 50, 10, 0));
  });

  it("stays even while dragging one step at a time", () => {
    render(<Editor start={rollout(25, 25, 25, 25)} values={variations("a", "b", "c", "d")} />);
    const slider = screen.getByRole("slider", { name: "Percent for a" });

    fireEvent.change(slider, { target: { value: "26" } });
    expect(percents()).toEqual([26, 24, 25, 25]);
    fireEvent.change(slider, { target: { value: "27" } });
    fireEvent.change(slider, { target: { value: "28" } });
    expect(percents()).toEqual([28, 24, 24, 24]);
    fireEvent.change(slider, { target: { value: "22" } });
    expect(percents()).toEqual([22, 26, 26, 26]);
  });

  it("moves from where the rows are now, not where they were", () => {
    render(<Editor start={rollout(50, 50, 0, 0)} values={variations("a", "b", "c", "d")} />);
    const slider = screen.getByRole("slider", { name: "Percent for a" });

    fireEvent.change(slider, { target: { value: "100" } });
    expect(percents()).toEqual([100, 0, 0, 0]);
    fireEvent.change(slider, { target: { value: "99" } });
    expect(percents()).toEqual([99, 1, 0, 0]);
    fireEvent.change(slider, { target: { value: "97" } });
    expect(percents()).toEqual([97, 1, 1, 1]);
    fireEvent.change(slider, { target: { value: "70" } });
    expect(percents()).toEqual([70, 10, 10, 10]);
  });

  it("can't take more than the rows above leave", () => {
    const onChange = vi.fn<(serve: Serve) => void>();
    render(<ServeEditor serve={rollout(70, 20, 10)} variations={variations("a", "b", "c")} onChange={onChange} />);

    fireEvent.change(screen.getByRole("slider", { name: "Percent for b" }), { target: { value: "90" } });
    expect(onChange).toHaveBeenLastCalledWith(rollout(70, 30, 0));
  });

  it("warns about an old total that is off", () => {
    render(<ServeEditor serve={rollout(50, 50, 20)} variations={variations("a", "b", "c")} onChange={() => {}} />);

    expect(screen.getByText("Total 120% — must be 100%")).toBeTruthy();
  });

  it("lets the last row move all the rows above it, nearest first", () => {
    render(<Editor start={rollout(25, 25, 25, 25)} values={variations("a", "b", "c", "d")} />);
    const slider = screen.getByRole("slider", { name: "Percent for d" });

    fireEvent.change(slider, { target: { value: "40" } });
    expect(percents()).toEqual([20, 20, 20, 40]);
    fireEvent.change(slider, { target: { value: "100" } });
    expect(percents()).toEqual([0, 0, 0, 100]);
    fireEvent.change(slider, { target: { value: "99" } });
    expect(percents()).toEqual([0, 0, 1, 99]);
    fireEvent.change(slider, { target: { value: "97" } });
    expect(percents()).toEqual([1, 1, 1, 97]);
  });

  it("splits evenly, giving the remainder to the first values", () => {
    const onChange = vi.fn<(serve: Serve) => void>();
    render(<ServeEditor serve={rollout(100, 0, 0)} variations={variations("a", "b", "c")} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Split evenly" }));
    expect(onChange).toHaveBeenLastCalledWith(rollout(34, 33, 33));
  });

  it("starts a new rollout split evenly", () => {
    const onChange = vi.fn<(serve: Serve) => void>();
    render(<ServeEditor serve={{ variationId: "v0" }} variations={variations("a", "b", "c", "d")} onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Serve" }), { target: { value: "__rollout" } });
    expect(onChange).toHaveBeenLastCalledWith(rollout(25, 25, 25, 25));
  });
});

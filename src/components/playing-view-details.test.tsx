import { useEffect, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PlayingViewDetails } from "./playing-view-details";
afterEach(cleanup);
it("preserves mounted input state while collapsing optional sound controls", () => {
  const mounted = vi.fn(), unmounted = vi.fn();
  function Input() { const [value, setValue] = useState("draft"); useEffect(() => { mounted(); return unmounted; }, []); return <input aria-label="Sound setting" value={value} onChange={e => setValue(e.target.value)} />; }
  const { container } = render(<PlayingViewDetails enabled><Input /></PlayingViewDetails>);
  const details = container.querySelector("details")!;
  expect(details.open).toBe(false); fireEvent.click(screen.getByText("Sound and practice details"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "retained" } });
  fireEvent.click(screen.getByText("Sound and practice details")); fireEvent.click(screen.getByText("Sound and practice details"));
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("retained"); expect(mounted).toHaveBeenCalledTimes(1); expect(unmounted).not.toHaveBeenCalled();
});

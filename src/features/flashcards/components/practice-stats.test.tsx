// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PracticeStats from "./practice-stats";

afterEach(cleanup);

describe("PracticeStats", () => {
  it("retains every Flashcard statistic and its value", () => {
    render(
      <PracticeStats
        stats={{
          correct: 3,
          incorrect: 1,
          streak: 2,
          totalResponseTimeMs: 4500,
        }}
      />,
    );

    const statistics = screen.getByRole("region", {
      name: "Flashcard session statistics",
    });
    const values = within(statistics).getAllByText(/Correct|Incorrect|Accuracy|Streak|Avg\. time|3|1|75%|2|1\.5s/);

    expect(values).toHaveLength(10);
  });
});

import { expect, test } from "@playwright/test";

test.describe("single-user smoke flow", () => {
  test("logs a workout without a login screen and persists it", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Home · FORGE/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Henry",
    );
    await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);

    // Start a known template rather than depending on the current weekday.
    await page.goto("/workouts/?tab=templates");
    await expect(
      page.getByRole("heading", { name: "Your templates" }),
    ).toBeVisible();
    await page
      .getByRole("tabpanel")
      .getByRole("button", { name: "Start", exact: true })
      .first()
      .click();

    await page.waitForURL(/\/workout\/$/, { timeout: 20_000 });

    const reps = page
      .getByRole("textbox", { name: /Reps for .* set 1$/ })
      .first();
    const weight = page
      .getByRole("textbox", { name: /Weight for .* set 1/ })
      .first();
    await expect(reps).toBeVisible();
    if (!(await weight.inputValue())) await weight.fill("20");
    await reps.fill("8");

    await page
      .getByRole("button", { name: "Complete set 1", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Mark set 1 incomplete" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Finish", exact: true }).click();
    const finishDialog = page.getByRole("dialog", {
      name: "Finish this workout?",
    });
    await expect(finishDialog).toBeVisible();
    await finishDialog
      .getByRole("button", { name: "Finish & save" })
      .click();

    await page.waitForURL(/\/workouts\/session\/\?id=.*finished=1/, {
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upper");
    await expect(
      page.getByText(/records were calculated from completed sets/i),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Dismiss rest timer" }),
    ).toHaveCount(0);

    // A full reload proves the anonymous session and Firestore data survived.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Upper");

    await page.goto("/progress/");
    await expect(
      page.getByRole("heading", { name: "The record" }),
    ).toBeVisible();
    await expect(page.getByText("training days completed")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Personal records" }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "The record" }),
    ).toBeVisible();

    await page.goto("/settings/");
    await expect(page.getByText("No login", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(
      0,
    );
    await expect(page.getByText("Henry", { exact: true }).first()).toBeVisible();
  });
});

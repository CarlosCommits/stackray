import { expect, test } from "@playwright/test";

test("loads the authenticated dashboard with the development actor", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByLabel("Targets")).toBeVisible();
  await expect(page.getByLabel("Runs")).toBeVisible();
  await expect(page.getByLabel(/Stackray Operator profile/)).toBeVisible();
});

test("renders core authenticated workspaces", async ({ page }) => {
  await page.goto("/runs");
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Submitted at" })).toBeVisible();

  await page.goto("/targets");
  await expect(page.getByRole("heading", { name: "Targets" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Latest scan" })).toBeVisible();
});

test("renders the new scan form without queueing a real scan", async ({ page }) => {
  await page.goto("/scans/new");

  await expect(page.getByRole("heading", { name: "New Scan" })).toBeVisible();
  await expect(page.getByText("Scan Configuration", { exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Target" })).toHaveValue("https://tpss.coop");
  await expect(page.getByRole("button", { name: "Queue Scan" })).toBeVisible();
});

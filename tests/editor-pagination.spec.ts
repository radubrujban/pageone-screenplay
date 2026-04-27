import { expect, test, type Page } from "@playwright/test";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd(), "");
const TEST_EMAIL = process.env.VITE_TEST_EMAIL ?? env.VITE_TEST_EMAIL ?? "";
const TEST_PASSWORD =
  process.env.VITE_TEST_PASSWORD ?? env.VITE_TEST_PASSWORD ?? "";

async function login(page: Page) {
  await page.goto("/login");

  const emailInput = page.getByLabel("Email");
  await expect(emailInput).toBeVisible();
  await emailInput.fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function findTextareaIndexByValue(page: Page, marker: string) {
  return page.locator("textarea").evaluateAll((nodes, markerValue) => {
    return nodes.findIndex((node) =>
      (node as HTMLTextAreaElement).value.includes(markerValue)
    );
  }, marker);
}

test("editor pagination and writing stability", async ({ page }, testInfo) => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Set VITE_TEST_EMAIL and VITE_TEST_PASSWORD to run this QA flow."
  );

  const topPageMarker = "TOP-PAGE-MARKER";
  const pageOneMarker = "PAGE-1-MARKER";
  const laterPageMarker = "PAGE-LATER-MARKER";
  const postTypewriterMarker = "TYPEWRITER-MARKER";
  const pageOneMarkerAt = 4;
  const laterPageMarkerAt = 80;

  await login(page);
  await page.getByRole("button", { name: "Start Writing" }).click();
  await expect(page).toHaveURL(/\/script\//);
  await expect(page.locator("textarea").first()).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("pagination-start.png"),
    fullPage: true,
  });

  const headingBlock = page.locator("textarea").first();
  await headingBlock.click();
  await headingBlock.fill(`INT. PAGINATION TEST ROOM - DAY ${topPageMarker}`);
  await page.keyboard.press("Enter");

  const longActionLine =
    "A steady action line that adds realistic screenplay body text for pagination coverage.";
  let reachedThreePages = false;

  for (let i = 0; i < 260; i += 1) {
    let focusedBlock = page.locator("textarea:focus");
    if ((await focusedBlock.count()) === 0) {
      focusedBlock = page.locator("textarea").last();
      await focusedBlock.click();
      focusedBlock = page.locator("textarea:focus");
    }

    const marker =
      i === pageOneMarkerAt
        ? ` ${pageOneMarker}`
        : i === laterPageMarkerAt
          ? ` ${laterPageMarker}`
          : "";
    await focusedBlock.fill(
      `Action beat ${i + 1}. ${longActionLine} ${longActionLine}${marker}`
    );

    if ((i + 1) % 10 === 0) {
      const pageCount = await page
        .locator("main section")
        .filter({ has: page.locator("textarea") })
        .count();
      if (pageCount >= 3 && i >= laterPageMarkerAt) {
        reachedThreePages = true;
        break;
      }
    }

    await page.keyboard.press("Enter");
  }

  const scriptPages = page.locator("main section").filter({
    has: page.locator("textarea"),
  });
  const pageCount = await scriptPages.count();
  expect(reachedThreePages || pageCount >= 3).toBeTruthy();

  const existingLaterMarkerIndex = await findTextareaIndexByValue(page, laterPageMarker);
  if (existingLaterMarkerIndex < 0) {
    const lastBlock = page.locator("textarea").last();
    await lastBlock.scrollIntoViewIfNeeded();
    await lastBlock.click();
    await lastBlock.fill(`Fallback later marker line. ${longActionLine} ${laterPageMarker}`);
  }

  await expect(page.locator("textarea").first()).toBeVisible();

  await scriptPages.first().scrollIntoViewIfNeeded();
  await expect(scriptPages.first()).toBeVisible();
  await scriptPages.nth(1).scrollIntoViewIfNeeded();
  await expect(scriptPages.nth(1)).toBeVisible();

  const firstMarkerIndex = await findTextareaIndexByValue(page, topPageMarker);
  expect(firstMarkerIndex).toBeGreaterThanOrEqual(0);
  const firstMarkerField = page.locator("textarea").nth(firstMarkerIndex);
  await firstMarkerField.scrollIntoViewIfNeeded();
  await expect(firstMarkerField).toBeVisible();

  const laterMarkerIndex = await findTextareaIndexByValue(page, laterPageMarker);
  expect(laterMarkerIndex).toBeGreaterThanOrEqual(0);
  const laterMarkerField = page.locator("textarea").nth(laterMarkerIndex);
  await laterMarkerField.scrollIntoViewIfNeeded();
  await expect(laterMarkerField).toBeVisible();

  await page.screenshot({
    path: testInfo.outputPath("pagination-filled.png"),
    fullPage: true,
  });

  await firstMarkerField.scrollIntoViewIfNeeded();
  await firstMarkerField.fill(`INT. PAGINATION TEST ROOM - DAY ${topPageMarker} EDITED`);

  const laterStillExistsIndex = await findTextareaIndexByValue(page, laterPageMarker);
  expect(laterStillExistsIndex).toBeGreaterThanOrEqual(0);

  const nearBreakBlock = scriptPages.nth(1).locator("textarea").first();
  await nearBreakBlock.scrollIntoViewIfNeeded();
  await nearBreakBlock.click();
  await nearBreakBlock.fill("");
  await page.keyboard.press("Backspace");

  const laterAfterMergeIndex = await findTextareaIndexByValue(page, laterPageMarker);
  expect(laterAfterMergeIndex).toBeGreaterThanOrEqual(0);

  const typewriterButton = page.getByRole("button", { name: "Typewriter" });
  await typewriterButton.click();
  await typewriterButton.click();
  const lastBlock = page.locator("textarea").last();
  await lastBlock.scrollIntoViewIfNeeded();
  await lastBlock.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");

  const newFocusedBlock = page.locator("textarea:focus");
  await expect(newFocusedBlock).toBeVisible();
  await newFocusedBlock.fill(
    `Typewriter stability line. ${longActionLine} ${postTypewriterMarker}`
  );

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("All changes saved")).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const openRecentButton = page.getByRole("button", { name: "Open Recent" });
  if (await openRecentButton.isEnabled()) {
    await openRecentButton.click();
  } else {
    await page.getByRole("button", { name: "Start Writing" }).click();
  }
  await expect(page).toHaveURL(/\/script\//);

  const allValues = await page.locator("textarea").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLTextAreaElement).value)
  );
  expect(allValues.length).toBeGreaterThan(0);
  expect(allValues.some((value) => value.includes(laterPageMarker))).toBeTruthy();
  expect(allValues.some((value) => value.includes(postTypewriterMarker))).toBeTruthy();

  await page.screenshot({
    path: testInfo.outputPath("pagination-after-reopen.png"),
    fullPage: true,
  });
});

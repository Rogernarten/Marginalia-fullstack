import { clerk } from "@clerk/testing/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Two readers sign in, each saves a word, and neither can see the other's.
//
// The readers are accounts in the Clerk development instance, named in .env.local as
// E2E_READER_A_EMAIL and E2E_READER_B_EMAIL. Make them with +clerk_test addresses (for example
// reader-a+clerk_test@example.com): Clerk sends no email and the code is always 424242.

const A = { email: process.env.E2E_READER_A_EMAIL ?? "", word: "Netherfield" };
const B = { email: process.env.E2E_READER_B_EMAIL ?? "", word: "Michaelmas" };

async function signedIn(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: email });
  return page;
}

async function openNotebook(page: Page) {
  await page.goto("/notebook");
  await expect(page.getByRole("heading", { level: 1, name: "Notebook" })).toBeVisible();
}

const wordIn = (page: Page, word: string) => page.getByRole("heading", { level: 3, name: word, exact: true });

const supabase = (method: string) => (r: { url(): string; request(): { method(): string } }) =>
  r.url().includes("/rest/v1/saved_words") && r.request().method() === method;

/** Start clean: take the word out of this reader's notebook if an earlier run left it there. */
async function removeIfThere(page: Page, word: string) {
  await openNotebook(page);
  const remove = page.getByRole("button", { name: `Remove “${word}”` });
  if ((await remove.count()) === 0) return;
  await Promise.all([page.waitForResponse(supabase("DELETE")), remove.click()]);
}

async function save(page: Page, word: string) {
  await page.goto(`/notebook/new?chapter=1&word=${encodeURIComponent(word)}`);
  await page.getByLabel("Your note").fill(`Saved by the test for ${word}`);
  const [saved] = await Promise.all([
    page.waitForResponse(supabase("POST")),
    page.getByRole("button", { name: "Save to notebook" }).click(),
  ]);
  expect(saved.status(), "Supabase accepted the new word").toBe(201);
}

test("two readers can't see each other's words", async ({ browser }) => {
  test.skip(!A.email || !B.email, "Set E2E_READER_A_EMAIL and E2E_READER_B_EMAIL in .env.local");

  const a = await signedIn(browser, A.email);
  const b = await signedIn(browser, B.email);
  await removeIfThere(a, A.word);
  await removeIfThere(b, B.word);

  await save(a, A.word);
  await save(b, B.word);

  // Load each notebook fresh from Supabase: your own word is there, the other reader's isn't.
  await openNotebook(a);
  await expect(wordIn(a, A.word)).toBeVisible();
  await expect(wordIn(a, B.word), "Reader A must not see reader B's word").toHaveCount(0);

  await openNotebook(b);
  await expect(wordIn(b, B.word)).toBeVisible();
  await expect(wordIn(b, A.word), "Reader B must not see reader A's word").toHaveCount(0);
});

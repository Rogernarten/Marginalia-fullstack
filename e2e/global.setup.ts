import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

// Gets a Clerk testing token, so sign-in in the tests isn't stopped by bot protection.
setup("get a Clerk testing token", async () => {
  await clerkSetup();
});

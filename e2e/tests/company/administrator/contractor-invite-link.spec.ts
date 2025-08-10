import { db } from "@test/db";
import { companiesFactory } from "@test/factories/companies";
import { companyAdministratorsFactory } from "@test/factories/companyAdministrators";
import { usersFactory } from "@test/factories/users";
import { login } from "@test/helpers/auth";
import { expect, test } from "@test/index";
import { eq } from "drizzle-orm";
import { companies, users } from "@/db/schema";

test.describe("Contractor Invite Link", () => {
  let company: typeof companies.$inferSelect;
  let admin: typeof users.$inferSelect;

  test.beforeEach(async () => {
    const result = await companiesFactory.create();
    company = result.company;
    const adminResult = await usersFactory.create();
    admin = adminResult.user;
    await companyAdministratorsFactory.create({
      companyId: company.id,
      userId: admin.id,
    });
  });

  test("shows invite link modal and allows copying invite link", async ({ page }) => {
    await login(page, admin);
    await page.getByRole("link", { name: "People" }).click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();

    await page.getByRole("button", { name: "Invite link" }).click();
    await expect(page.getByRole("heading", { name: "Invite Link" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByRole("textbox", { name: "Link" })).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => Promise.resolve(),
        },
        configurable: true,
      });
    });

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Copied!")).toBeVisible();

    let updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    const link = updatedCompany?.inviteLink;
    expect(link).toBeDefined();

    await page.getByRole("button", { name: "Reset link" }).click();
    await expect(page.getByText("Reset Invite Link")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();

    await expect(page.getByRole("button", { name: "Copy" })).toBeEnabled();
    await expect(page.getByText("Reset Invite Link")).not.toBeVisible();

    updatedCompany = await db.query.companies.findFirst({ where: eq(companies.id, company.id) });
    expect(updatedCompany?.inviteLink).not.toEqual(link);
  });
});

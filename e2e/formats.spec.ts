import { test, expect } from "@playwright/test";
import { EXAMPLE_SCHEMAS, parseSchemaFile } from "db-schema-toolkit";
const formats = [...new Map(EXAMPLE_SCHEMAS.map((sample) => [sample.category, sample])).values()];
formats.push(
  { name: "Sequelize", description: "", category: "sequelize", fileName: "schema.ts", sql: `const User = sequelize.define('User', { id: { type: DataTypes.INTEGER, primaryKey: true }, name: { type: DataTypes.STRING } });` },
  { name: "MikroORM", description: "", category: "mikroorm", fileName: "schema.ts", sql: `@Entity()
export class User {
@PrimaryKey()
id!: number;
@Property()
name!: string;
}` },
  { name: "Kysely", description: "", category: "kysely", fileName: "schema.ts", sql: `interface Database {
users: UsersTable;
}
interface UsersTable {
id: Generated<number>;
name: string;
}` },
);
for (const sample of formats) {
  test(`worker imports ${sample.category}`, async ({ page }) => {
    const expected = parseSchemaFile(sample.sql, sample.fileName);
    await page.goto("./");
    await page.getByRole("button", { name: "Import Schema", exact: true }).click();
    await page.getByRole("button", { name: /Auto-Detect/ }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: sample.fileName!, mimeType: "text/plain", buffer: Buffer.from(sample.sql) });
    await expect(page.locator(".react-flow__node-table")).toHaveCount(expected.tables.length);
    await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
  });
}

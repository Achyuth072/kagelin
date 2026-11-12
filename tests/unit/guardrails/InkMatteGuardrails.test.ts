import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";
import { execSync } from "child_process";
import path from "path";

describe("Ink & Matte Guardrails", () => {
  const rootDir = path.resolve(__dirname, "../../..");

  it("ESLint blocks forbidden restyling (fuzzy shadows, oversized radii, backdrop-blur)", async () => {
    const eslint = new ESLint();
    const [result] = await eslint.lintText(
      `import { Button } from "@/components/ui/button";
export const BadComponent = () => (
  <Button className="shadow-2xl shadow-md rounded-2xl backdrop-blur-sm" />
);`,
      { filePath: path.join(rootDir, "src/components/BadComponent.tsx") },
    );

    const messages = result.messages.map((m) => m.message);
    expect(
      messages.some(
        (m) =>
          m.includes("fuzzy elevation shadows") ||
          m.includes("shadow-2xl") ||
          m.includes("shadow-md"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("rounded-2xl") || m.includes("radii")),
    ).toBe(true);
    expect(
      messages.some(
        (m) => m.includes("glassmorphism") || m.includes("backdrop-blur"),
      ),
    ).toBe(true);
  });

  it("ESLint blocks eager motion and legacy framer-motion imports", async () => {
    const eslint = new ESLint();
    const [result] = await eslint.lintText(
      `import { motion } from "motion/react";
import framerMotion from "framer-motion";
export const BadMotion = () => <motion.div />;`,
      { filePath: path.join(rootDir, "src/components/BadMotion.tsx") },
    );

    const restrictedMessages = result.messages
      .filter((m) => m.ruleId === "no-restricted-imports")
      .map((m) => m.message);

    expect(restrictedMessages.length).toBeGreaterThanOrEqual(2);
    expect(restrictedMessages.some((m) => m.includes("LazyMotion"))).toBe(true);
  });

  it("ast-grep flags eager motion imports", () => {
    const badCode = 'import { motion } from "motion/react";';
    const rulePath = path.join(rootDir, ".ast-grep/rules/no-eager-motion.yml");

    expect(() => {
      execSync(`npx ast-grep scan -r ${rulePath} --stdin`, {
        input: badCode,
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }).toThrow();
  });

  it("ast-grep flags unguarded animate-pulse without motion-reduce:animate-none", () => {
    const badCode = '<div className="h-4 w-4 animate-pulse" />';
    const rulePath = path.join(
      rootDir,
      ".ast-grep/rules/no-unguarded-animate-pulse.yml",
    );

    expect(() => {
      execSync(`npx ast-grep scan -r ${rulePath} --stdin`, {
        input: badCode,
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }).toThrow();

    // Guarded pulse should pass
    const goodCode =
      '<div className="h-4 w-4 animate-pulse motion-reduce:animate-none" />';
    const output = execSync(`npx ast-grep scan -r ${rulePath} --stdin`, {
      input: goodCode,
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    expect(output).not.toContain("error");
  });

  it('ast-grep flags raw <input type="number">', () => {
    const badCode = '<input type="number" min={1} max={10} />';
    const rulePath = path.join(
      rootDir,
      ".ast-grep/rules/no-raw-number-input.yml",
    );

    expect(() => {
      execSync(`npx ast-grep scan -r ${rulePath} --stdin`, {
        input: badCode,
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }).toThrow();
  });

  it("ast-grep flags Lucide icons with non-2.25 strokeWidth", () => {
    const badCode = '<Sparkles className="h-4 w-4" strokeWidth={2} />';
    const rulePath = path.join(
      rootDir,
      ".ast-grep/rules/lucide-stroke-width.yml",
    );

    expect(() => {
      execSync(`npx ast-grep scan -r ${rulePath} --stdin`, {
        input: badCode,
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    }).toThrow();

    // strokeWidth={2.25} should pass
    const goodCode = '<Sparkles className="h-4 w-4" strokeWidth={2.25} />';
    const output = execSync(`npx ast-grep scan -r ${rulePath} --stdin`, {
      input: goodCode,
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    expect(output).not.toContain("error");
  });
});

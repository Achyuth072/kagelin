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

  it("ESLint blocks rounded-2xl and elevated shadows on raw HTML/Motion elements and shadowClass props", async () => {
    const eslint = new ESLint();
    const [badResult] = await eslint.lintText(
      `import { m } from "motion/react";
export const BadRawSurfaces = () => (
  <div className="rounded-2xl shadow-lg backdrop-blur-md">
    <m.div className="shadow-md" />
    <FloatingPanel shadowClass="shadow-md" />
  </div>
);`,
      { filePath: path.join(rootDir, "src/components/BadRawSurfaces.tsx") },
    );

    const surfaceErrors = badResult.messages.filter(
      (m) => m.ruleId === "local/no-elevated-matte-tokens" && m.severity === 2,
    );
    expect(surfaceErrors.length).toBeGreaterThanOrEqual(4);
    expect(surfaceErrors.some((m) => m.message.includes("rounded-2xl"))).toBe(
      true,
    );
    expect(surfaceErrors.some((m) => m.message.includes("shadow-lg"))).toBe(
      true,
    );
    expect(surfaceErrors.some((m) => m.message.includes("shadow-md"))).toBe(
      true,
    );
    expect(
      surfaceErrors.some((m) => m.message.includes("backdrop-blur-md")),
    ).toBe(true);

    const [goodResult] = await eslint.lintText(
      `export const GoodMatteSurface = () => (
  <div className="rounded-xl shadow-sm border border-border">
    <FloatingPanel shadowClass="shadow-sm" />
  </div>
);`,
      { filePath: path.join(rootDir, "src/components/GoodMatteSurface.tsx") },
    );
    expect(
      goodResult.messages.filter(
        (m) => m.ruleId === "local/no-elevated-matte-tokens",
      ),
    ).toHaveLength(0);
  });

  it("ESLint enforces strokeWidth={2.25} on lucide-react icons across stats/ while sparing Recharts and CircularProgress", async () => {
    const eslint = new ESLint();
    const [statsResult] = await eslint.lintText(
      `import { Sparkles, Calendar as CalendarIcon, Flame } from "lucide-react";
import { Line } from "recharts";
import { CircularProgress } from "@/components/ui/circular-progress";

export const BadStatsChart = () => (
  <div>
    <Sparkles className="h-4 w-4" />
    <CalendarIcon className="h-4 w-4" strokeWidth={2} />
    <Flame className="h-4 w-4" strokeWidth={2.25} />
    <Line type="monotone" dataKey="value" strokeWidth={2} />
    <CircularProgress value={50} strokeWidth={3} />
  </div>
);`,
      {
        filePath: path.join(rootDir, "src/components/stats/BadStatsChart.tsx"),
      },
    );

    const lucideErrors = statsResult.messages.filter(
      (m) => m.ruleId === "local/lucide-stroke-width" && m.severity === 2,
    );
    expect(lucideErrors).toHaveLength(2);
    expect(lucideErrors.some((m) => m.message.includes("Sparkles"))).toBe(true);
    expect(lucideErrors.some((m) => m.message.includes("CalendarIcon"))).toBe(
      true,
    );

    const [uiResult] = await eslint.lintText(
      `import { Check, X } from "lucide-react";
export const UiPrimitiveIcons = () => (
  <>
    <Check className="h-4 w-4" strokeWidth={3} />
    <X className="h-4 w-4" />
  </>
);`,
      {
        filePath: path.join(rootDir, "src/components/ui/UiPrimitiveIcons.tsx"),
      },
    );
    const uiErrors = uiResult.messages.filter(
      (m) => m.ruleId === "local/lucide-stroke-width" && m.severity === 2,
    );
    expect(uiErrors).toHaveLength(1);
    expect(uiErrors[0].message).toContain("X");
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

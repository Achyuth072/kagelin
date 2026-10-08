import { describe, it, expect } from "vitest";
import {
  applyReadableUpdate,
  omitUntouchedUnreadable,
} from "@/lib/crypto/unreadable";

describe("applyReadableUpdate", () => {
  it("merges the update into the row", () => {
    expect(applyReadableUpdate({ id: "t1", name: "a" }, { name: "b" })).toEqual(
      { id: "t1", name: "b" },
    );
  });

  it("drops a column from the marker when the update sets it", () => {
    const row = {
      id: "t1",
      content: null,
      unreadable: ["content", "description"],
    };
    const merged = applyReadableUpdate(row, { content: "Retyped" });
    expect(merged).toEqual({
      id: "t1",
      content: "Retyped",
      unreadable: ["description"],
    });
  });

  it("removes the marker key once every unreadable column is set", () => {
    const row = { id: "t1", content: null, unreadable: ["content"] };
    expect(applyReadableUpdate(row, { content: "Retyped" })).not.toHaveProperty(
      "unreadable",
    );
  });

  it("keeps the marker when the update does not touch an unreadable column", () => {
    const row = { id: "t1", content: null, unreadable: ["content"] };
    expect(applyReadableUpdate(row, { is_completed: true })).toEqual({
      id: "t1",
      content: null,
      is_completed: true,
      unreadable: ["content"],
    });
  });

  it("treats an explicit null as a set field", () => {
    const row = { id: "t1", description: null, unreadable: ["description"] };
    expect(applyReadableUpdate(row, { description: null })).not.toHaveProperty(
      "unreadable",
    );
  });
});

describe("omitUntouchedUnreadable", () => {
  const row = { unreadable: ["description"] };

  it("drops an unreadable column the form left empty", () => {
    expect(
      omitUntouchedUnreadable(row, {
        id: "t1",
        content: "New",
        description: "",
      }),
    ).toEqual({ id: "t1", content: "New" });
  });

  it("keeps an unreadable column the user retyped", () => {
    const payload = { id: "t1", description: "Typed" };
    expect(omitUntouchedUnreadable(row, payload)).toEqual(payload);
  });

  it("keeps an empty column that is not unreadable", () => {
    const payload = { id: "t1", description: "" };
    expect(omitUntouchedUnreadable({}, payload)).toEqual(payload);
  });
});

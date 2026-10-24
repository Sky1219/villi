import { describe, expect, it } from "vitest";
import { looksLikeNdc, packageNdcsFor, parseCode, productName } from "./lib/barcode";

describe("barcode parsing", () => {
  it("reads the NDC out of a UPC-A drug barcode and tries every hyphen split", () => {
    // Toprol XL 25 mg, package NDC 71610-035-45: UPC-A "3" + 7161003545 + check digit.
    const p = parseCode("371610035455");
    expect(p).toEqual({ kind: "ndc", ndc10: "7161003545", packageNdcs: ["7161-0035-45", "71610-035-45", "71610-0354-5"] });
  });

  it("reads a GS1 GTIN-14 from a DataMatrix, with or without parentheses", () => {
    expect(parseCode("(01)00371610035459(17)270131(10)A1B2")).toMatchObject({ kind: "ndc", ndc10: "7161003545" });
    expect(parseCode("0100371610035459\x1d17270131")).toMatchObject({ kind: "ndc", ndc10: "7161003545" });
  });

  it("takes a typed NDC, hyphenated as printed or as plain digits", () => {
    expect(parseCode("71610-035-45")).toEqual({ kind: "ndc", ndc10: "7161003545", packageNdcs: ["71610-035-45"] });
    expect(parseCode("7161003545")).toMatchObject({ kind: "ndc", packageNdcs: packageNdcsFor("7161003545") });
    // 11-digit (5-4-2) with its padding zero.
    expect((parseCode("71610003545") as { packageNdcs: string[] }).packageNdcs).toContain("71610-035-45");
    expect(looksLikeNdc("71610-035-45")).toBe(true);
    expect(looksLikeNdc("Metoprolol 25 mg")).toBe(false);
  });

  it("treats a non-NDC retail barcode as a UPC, and junk as nothing", () => {
    expect(parseCode("041167055045")).toEqual({ kind: "upc", upc: "041167055045" });
    expect(parseCode("hello")).toEqual({ kind: "none" });
  });

  it("names the product plainly", () => {
    expect(productName({ brandName: "TOPROL XL", strength: "25 mg/1", dosageForm: "TABLET, EXTENDED RELEASE" })).toBe(
      "Toprol XL 25 mg tablet, extended release",
    );
  });
});

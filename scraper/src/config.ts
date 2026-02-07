import { CompanyTypes } from "israeli-bank-scrapers";

/** Maps our institution keys to the library's CompanyTypes enum. */
export const INSTITUTION_TO_COMPANY: Record<string, CompanyTypes> = {
  leumi: CompanyTypes.leumi,
  discount: CompanyTypes.discount,
  one_zero: CompanyTypes.oneZero,
  isracard: CompanyTypes.isracard,
  cal: CompanyTypes.visaCal,
  hapoalim: CompanyTypes.hapoalim,
  mizrahi: CompanyTypes.mizrahi,
};

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

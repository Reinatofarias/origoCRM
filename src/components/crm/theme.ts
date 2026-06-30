export type CrmTheme = "dark" | "light";

export function readCrmTheme(): CrmTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("origocrm:theme") === "light" ? "light" : "dark";
}

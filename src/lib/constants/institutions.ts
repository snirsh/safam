export const INSTITUTIONS = {
  leumi: {
    label: "Bank Leumi",
    credentials: ["username", "password"],
  },
  discount: {
    label: "Bank Discount",
    credentials: ["id", "password", "num"],
  },
  one_zero: {
    label: "One Zero",
    credentials: ["email", "password"],
  },
  isracard: {
    label: "Isracard",
    credentials: ["id", "card6Digits", "password"],
  },
  cal: {
    label: "Cal",
    credentials: ["username", "password"],
  },
  hapoalim: {
    label: "Bank Hapoalim",
    credentials: ["userCode", "password"],
  },
  mizrahi: {
    label: "Bank Mizrahi",
    credentials: ["username", "password"],
  },
} as const;

export type InstitutionKey = keyof typeof INSTITUTIONS;

export const CREDENTIAL_LABELS: Record<string, string> = {
  username: "Username / שם משתמש",
  password: "Password / סיסמה",
  email: "Email / אימייל",
  id: "ID / תעודת זהות",
  num: "Card Number / מספר כרטיס",
  card6Digits: "Card 6 Digits / 6 ספרות ראשונות",
  userCode: "User Code / קוד משתמש",
};

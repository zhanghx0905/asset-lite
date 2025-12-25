export type Currency = "CNY" | "USD";

export type Subject = {
  id: string;
  name: string;
  bucket: "Cash" | "Invest" | "Social" | "Other";
  defaultCurrency: Currency;
  isIndexLike?: boolean;
  includeInNetWorth?: boolean; // e.g. allow excluding Receivable if you want
};

export type MonthlyEntry = {
  subjectId: string;
  currency: Currency;
  formula: string; // user input formula
  amount: number;  // evaluated numeric
};

export type MonthRecord = {
  month: string; // YYYY-MM
  entries: MonthlyEntry[];
  note?: string;
};

export type AppState = {
  subjects: Subject[];
  months: MonthRecord[];
  settings: {
    // working fx for conversion (USDCNH)
    usdcnhManual: number;
    // try auto update by corsproxy (optional)
    enableCorsProxyAutoFx: boolean;
  };
};

export type AutoFxState = {
  usdcnh?: number;
  status: "idle" | "ok" | "error";
  message?: string;
  updatedAt?: number;
};

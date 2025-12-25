import { AppState } from "../types";

const KEY = "asset-hq-lite-v1";

export function defaultState(): AppState {
  return {
    subjects: [
      { id: "wx", name: "微信", bucket: "Cash", defaultCurrency: "CNY", includeInNetWorth: true },
      { id: "zfb", name: "支付宝", bucket: "Cash", defaultCurrency: "CNY", includeInNetWorth: true },
      { id: "bank", name: "银行账户", bucket: "Cash", defaultCurrency: "CNY", includeInNetWorth: true },

      { id: "usdIndex", name: "美元券商（指数ETF）", bucket: "Invest", defaultCurrency: "USD", isIndexLike: true, includeInNetWorth: true },
      { id: "usdOther", name: "美元券商（现金/债券/个股）", bucket: "Invest", defaultCurrency: "USD", isIndexLike: false, includeInNetWorth: true },

      { id: "cnyEtf", name: "人民币券商（ETF）", bucket: "Invest", defaultCurrency: "CNY", isIndexLike: true, includeInNetWorth: true },

      { id: "crypto", name: "Crypto（USDT计）", bucket: "Invest", defaultCurrency: "USD", includeInNetWorth: true },

      { id: "receivable", name: "应收账款（未来1个月）", bucket: "Other", defaultCurrency: "CNY", includeInNetWorth: true },

      { id: "housingFund", name: "公积金", bucket: "Social", defaultCurrency: "CNY", includeInNetWorth: true }
    ],
    months: [],
    settings: {
      usdcnhManual: 7.2,
      enableCorsProxyAutoFx: true
    }
  };
}

export function loadState(): AppState {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as AppState;
    } catch {}
  }
  return defaultState();
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

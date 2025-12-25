# Asset Lite（单页 / 前端-only / 科目制）

- 技术栈：Vite + React + TypeScript + Recharts
- 存储：LocalStorage（可导入/导出 JSON）
- 行情：优先用 TradingView Widgets 直接嵌入（无需后端、无 CORS 问题）citeturn1search0turn1search12
- 说明：你要求“前端直接实时拉取 USDCNH / QQQ / NDX / BTC”，但多数行情 API 在浏览器会被 CORS 限制。
  这个项目用 TradingView 的嵌入组件保证“实时展示”。
  若你还希望**把 USDCNH 的数值自动写入换算计算**，我加了一个“可选的无后端抓取（corsproxy.io）”开关：可用则自动填，不可用则手动填。citeturn1search4turn1search1

## 运行
```bash
npm i
npm run dev
```
打开 http://localhost:5173

## 主要功能
- 单页：行情卡片（USDCNH / QQQ / NDX / BTC）+ 月度录入 + 趋势洞察 + 设置/备份
- 科目（不是“组件”）：微信、支付宝、银行账户（含微众等）、美元券商（指数ETF）、美元券商（其他）、人民币券商（ETF）、Crypto、应收账款（未来1个月）、公积金等
- 输入框支持公式：例如 `10000 + 2500 - 199.9*3`（支持括号、乘除加减）
- 双货币：CNY/USD 同时展示（USD 科目按 USDCNH 换算）
- 趋势洞察：净资产趋势（CNY & USD）、科目结构（堆叠面积）、指数化占比趋势

## 备注
- “应收账款”默认计入净资产（你可以在 Settings 里关闭）。

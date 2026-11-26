"use strict";

const quotes = new Map();
const quoteAssets = ["BTC", "ETH"];
const pollMs = 10000;
const maxAgeMs = 60000;
const quoteClock = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
});
let quoteRequestPending = false;
let quoteRequestFailed = false;

async function fetchQuoteJSON(url, signal) {
  const response = await fetch(url, {cache: "no-store", signal});
  if (!response.ok) throw Error("行情请求失败");
  return response.json();
}

function normalizeQuote(priceValue, openValue, timeValue, source) {
  const price = Number(priceValue), open = Number(openValue), time = Number(timeValue);
  const age = Date.now() - time;
  if (![price, open, time].every(Number.isFinite) || price <= 0 || open <= 0 ||
      age < -15000 || age >= maxAgeMs) throw Error("无有效近时报价");
  return {price, change: (price / open - 1) * 100, time, source};
}

async function fetchOKX(signal) {
  return Promise.all(quoteAssets.map(async asset => {
    const pair = asset + "-USDT";
    const result = await fetchQuoteJSON("https://www.okx.com/api/v5/market/ticker?instId=" + pair + "&t=" + Date.now(), signal);
    const row = result.data?.[0];
    if (result.code !== "0" || row?.instId !== pair) throw Error("交易对不符");
    return normalizeQuote(row.last, row.open24h, row.ts, "OKX");
  }));
}

async function fetchBinance(signal) {
  const symbols = quoteAssets.map(asset => asset + "USDT");
  const url = new URL("https://data-api.binance.vision/api/v3/ticker/24hr");
  url.searchParams.set("symbols", JSON.stringify(symbols));
  const rows = await fetchQuoteJSON(url, signal);
  return symbols.map(symbol => {
    const row = rows.find(item => item.symbol === symbol);
    return normalizeQuote(row.lastPrice, row.openPrice, row.closeTime, "Binance");
  });
}

async function refreshQuotes() {
  if (document.hidden || quoteRequestPending) return;
  quoteRequestPending = true;
  try {
    for (const provider of [fetchOKX, fetchBinance]) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const result = await provider(controller.signal);
        quoteAssets.forEach((asset, index) => {
          if (!quotes.has(asset) || result[index].time >= quotes.get(asset).time) quotes.set(asset, result[index]);
        });
        quoteRequestFailed = false;
        return;
      } catch {
        quoteRequestFailed = true;
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    }
  } finally {
    quoteRequestPending = false;
    paintQuotes();
  }
}

function paintQuotes() {
  for (const asset of quoteAssets) {
    const card = document.getElementById("quote-" + asset);
    if (!card) continue;
    const quote = quotes.get(asset);
    const changeText = card.querySelector("[data-change]");
    const stamp = card.querySelector("[data-stamp]");
    if (!quote) {
      stamp.textContent = quoteRequestFailed ? "暂未取得现价 · 自动重试中" : "正在获取现货报价…";
      continue;
    }
    card.querySelector("[data-price]").textContent = money(quote.price);
    changeText.textContent = signed(quote.change, 2) + "%";
    changeText.className = quote.change < 0 ? "fall" : "rise";
    const distance = 100 * (1 - coins[asset].target / quote.price);
    card.querySelector("[data-gap]").textContent = distance > 0 ? "还需跌 " + distance.toFixed(1) + "%" : "已到目标区间";
    const status = quoteRequestFailed || Date.now() - quote.time >= maxAgeMs ? "上次报价" : "现货";
    stamp.textContent = quote.source + " " + status + " · " + quoteClock.format(quote.time) + " 北京时间";
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { paintQuotes(); refreshQuotes(); }
});
window.addEventListener("pageshow", () => { paintQuotes(); refreshQuotes(); });
window.addEventListener("online", refreshQuotes);
setInterval(() => { if (!document.hidden) { paintQuotes(); refreshQuotes(); } }, pollMs);
refreshQuotes();

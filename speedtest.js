#!/usr/bin/env node
"use strict";

const REQUESTS_COUNT = 10;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseUrl(raw) {
  if (!raw) {
    fail("Использование: node speedtest.js <url>\nПример: node speedtest.js https://example.com/big-image.jpg");
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      fail("Поддерживаются только http:// и https:// адреса.");
    }
    return url;
  } catch {
    return fail(`Некорректный URL: ${raw}`);
  }
}

// Один запрос: ждём, пока тело ответа будет скачано целиком.
async function download(url) {
  const start = performance.now();

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      "Accept-Encoding": "identity", // без сжатия, чтобы считать реальный объём
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
  }

  const seconds = (performance.now() - start) / 1000;
  return { bytes, seconds };
}

const mbit = (bytes) => (bytes * 8) / 1e6;
const mb = (bytes) => bytes / 1e6;

async function main() {
  const url = parseUrl(process.argv[2]);

  console.log(`Адрес: ${url.href}`);
  console.log(`Запросов: ${REQUESTS_COUNT} (последовательно)\n`);

  const results = [];

  for (let i = 1; i <= REQUESTS_COUNT; i++) {
    try {
      const { bytes, seconds } = await download(url);
      results.push({ bytes, seconds });
      console.log(
        `#${String(i).padStart(2)}: ${seconds.toFixed(3)} с, ${mb(bytes).toFixed(2)} МБ, ` +
          `${(mbit(bytes) / seconds).toFixed(2)} Мбит/с`
      );
    } catch (err) {
      console.log(`#${String(i).padStart(2)}: ошибка — ${err.message}`);
    }
  }

  if (results.length === 0) {
    fail("\nНи один запрос не завершился успешно.");
  }

  const totalBytes = results.reduce((s, r) => s + r.bytes, 0);
  const totalSeconds = results.reduce((s, r) => s + r.seconds, 0);
  const avgSeconds = totalSeconds / results.length;
  const speed = mbit(totalBytes) / totalSeconds;

  console.log("\n--- Итог ---");
  console.log(`Успешных запросов:    ${results.length} из ${REQUESTS_COUNT}`);
  console.log(`Среднее время:        ${avgSeconds.toFixed(3)} с`);
  console.log(`Скачано всего:        ${mb(totalBytes).toFixed(2)} МБ`);
  console.log(`Скорость скачивания:  ${speed.toFixed(2)} Мбит/с (${(speed / 8).toFixed(2)} МБ/с)`);
}

main().catch((err) => fail(`Непредвиденная ошибка: ${err.message}`));

// Fetches a URL server-side (no CORS concerns - CORS only restricts browser
// fetches, not a Node backend) and extracts its first data table as
// tab-separated text, so it can be fed straight into the same
// parseTradeValueText/parseRankingsText + matchRows pipeline a manual
// paste goes through.
//
// Verified against Boone's Yahoo "Trade Value Chart" pages: they're
// server-rendered with a real `<table class="content-table">` in the raw
// HTML (no JS execution needed) for both the HALF/PPR pages and the QB
// 1QB/2QB page. His plain rankings pages are prose articles with no table
// at all, so this only helps the trade-value-chart uploads, not rankings.
const cheerio = require('cheerio');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function fetchTableAsTsv(url) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } catch (e) {
    throw new Error(`Could not reach that URL: ${e.message}`);
  }
  if (!res.ok) {
    throw new Error(`That page returned HTTP ${res.status}.`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const table = $('table.content-table').first().length ? $('table.content-table').first() : $('table').first();
  if (!table.length) {
    throw new Error(
      'No table found on that page - this scraper only works for pages with an actual HTML table (e.g. Boone\'s Trade Value Chart pages), not his prose rankings articles. Paste the data manually instead.'
    );
  }

  const lines = [];
  table.find('tr').each((_, tr) => {
    const cells = $(tr)
      .find('td, th')
      .map((__, cell) => $(cell).text().trim())
      .get();
    if (cells.length) lines.push(cells.join('\t'));
  });

  if (lines.length < 2) {
    throw new Error('Found a table on that page, but it had no usable rows.');
  }
  return lines.join('\n');
}

module.exports = { fetchTableAsTsv };

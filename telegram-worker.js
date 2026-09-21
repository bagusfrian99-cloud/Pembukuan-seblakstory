export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Browser/PWA cross-origin support.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        status: "ok",
        service: "Seblak Story Telegram",
        database: "D1"
      }, 200, request);
    }

    if (request.method === "GET" && url.pathname === "/api/inbox") {
      const auth = request.headers.get("Authorization");
      if (!env.APP_API_KEY || auth !== `Bearer ${env.APP_API_KEY}`) {
        return json({ error: "Unauthorized" }, 401, request);
      }

      const result = await env.DB.prepare(`
        SELECT *
        FROM shift_reports
        ORDER BY id DESC
        LIMIT 50
      `).all();

      return json({ success: true, reports: result.results }, 200, request);
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
        return json({ error: "Unauthorized" }, 401, request);
      }

      const update = await request.json();
      const message = update.message || update.edited_message || update.channel_post;
      if (!message) return json({ ok: true, ignored: true }, 200, request);

      const text = message.text || message.caption || "";
      const upper = text.toUpperCase();
      if (!upper.includes("LAPORAN SHIFT")) {
        return json({ ok: true, ignored: true }, 200, request);
      }

      const tanggal = getValue(text, /Tanggal\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
      const shift = getValue(text, /Shift\s*:\s*([^\r\n]+)/i);
      const kasir = getValue(text, /Kasir\s*:\s*([^\r\n]+)/i);
      const transaksi = getNumber(getValue(text, /Transaksi\s*:\s*([0-9.,]+)/i));
      const penjualan = getNumber(getValue(text, /Penjualan\s*:\s*Rp?\s*([0-9.,]+)/i));
      const tunai = getNumber(getValue(text, /Cash\s*:\s*Rp?\s*([0-9.,]+)/i));
      const nonTunai = getNumber(getValue(text, /Nontunai\s*:\s*Rp?\s*([0-9.,]+)/i));
      const pengeluaran = getNumber(getValue(text, /Pengeluaran\s*:\s*Rp?\s*([0-9.,]+)/i));
      const saldo = getNumber(getValue(text, /Saldo\s*:\s*Rp?\s*([0-9.,]+)/i));

      if (!tanggal || !shift || tunai === null || nonTunai === null) {
        return json({ ok: false, ignored: true, reason: "Format laporan tidak lengkap" }, 200, request);
      }

      const existing = await env.DB.prepare(`
        SELECT id FROM shift_reports
        WHERE tanggal = ? AND shift = ?
        LIMIT 1
      `).bind(tanggal, shift.trim()).first();

      if (existing) {
        return json({ ok: true, duplicate: true, message: "Laporan shift sudah pernah diproses" }, 200, request);
      }

      await env.DB.prepare(`
        INSERT INTO shift_reports (
          tanggal, shift, kasir, transaksi, penjualan,
          tunai, non_tunai, pengeluaran, saldo, telegram_message_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tanggal, shift.trim(), kasir || "", transaksi ?? 0, penjualan ?? 0,
        tunai, nonTunai, pengeluaran ?? 0, saldo ?? 0, message.message_id || null
      ).run();

      return json({
        ok: true,
        saved: true,
        tanggal,
        shift: shift.trim(),
        tunai,
        nonTunai
      }, 200, request);
    }

    return json({ error: "Not Found" }, 404, request);
  }
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Telegram-Bot-Api-Secret-Token",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=UTF-8"
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(request)
  });
}

function getValue(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function getNumber(value) {
  if (value === null || value === undefined) return null;
  const number = String(value).replace(/[^\d]/g, "");
  if (!number) return null;
  return Number(number);
}

// Tiny proxy server: no dependencies, needs Node 18+ (built-in fetch).
const http = require("http"), fs = require("fs"), path = require("path");
const PORT = process.env.PORT || 3000;
const OSRM = process.env.OSRM_URL || "https://router.project-osrm.org";
// Contact email for Nominatim: put it alone in a file called contact.txt (keep that file out of GitHub).
let CONTACT = "set-your-email@example.com";
try { CONTACT = fs.readFileSync(path.join(__dirname, "contact.txt"), "utf8").trim() || CONTACT; } catch (e) {}
const UA = { "User-Agent": "roadtrip-planner-portfolio/2.0 (" + CONTACT + ")" };
let rates = null;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
const coords = pts => pts.map(p => p.lon + "," + p.lat).join(";");

const why = e => (e.cause && (e.cause.code || e.cause.message)) || e.message;
async function loadRates() {
  try {   // main source: European Central Bank daily file
    const r = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", { headers: UA, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const x = await r.text(), m = { EUR: 1 };
    for (const k of x.matchAll(/currency=['"](\w+)['"]\s+rate=['"]([\d.]+)['"]/g)) m[k[1]] = +k[2];
    if (Object.keys(m).length < 5) throw new Error("file not understood");
    return { date: (x.match(/time=['"]([\d-]+)['"]/) || [])[1], rates: m, source: "ECB" };
  } catch (e1) {
    try {   // backup: Frankfurter republishes the same ECB rates as JSON
      const r = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR", { signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = await r.json();
      return { date: d.date, rates: { EUR: 1, ...d.rates }, source: "ECB via Frankfurter" };
    } catch (e2) { throw new Error("ECB: " + why(e1) + "; backup: " + why(e2)); }
  }
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  try {
    if (u.pathname === "/api/geocode") {            // city name -> coordinates
      const q = u.searchParams.get("q") || "";
      const base = "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" + encodeURIComponent(q);
      let d = await (await fetch(base + "&featuretype=settlement", { headers: UA })).json();   // towns and cities first
      if (!d.length) d = await (await fetch(base, { headers: UA })).json();                     // fallback: anything
      return json(res, 200, d.map(x => ({ name: x.display_name, lat: +x.lat, lon: +x.lon, type: x.addresstype || x.type })));
    }
    if (u.pathname === "/api/rates") {               // official ECB euro reference rates (free, no key), cached 1 hour
      if (!rates || Date.now() - rates.t > 3600e3) rates = { t: Date.now(), ...(await loadRates()) };
      return json(res, 200, { date: rates.date, rates: rates.rates, source: rates.source });
    }
    if (u.pathname === "/api/table" && req.method === "POST") {   // real road distances + times
      const pts = JSON.parse(await body(req));
      if (pts.length > 40) return json(res, 400, { error: "Max 40 stops" });
      const r = await fetch(`${OSRM}/table/v1/driving/${coords(pts)}?annotations=distance,duration`);
      const d = await r.json();
      if (d.code !== "Ok") return json(res, 502, { error: d.message || d.code });
      return json(res, 200, { km: d.distances.map(a => a.map(m => m / 1000)), hours: d.durations.map(a => a.map(s => s / 3600)) });
    }
    if (u.pathname === "/api/route" && req.method === "POST") {   // road geometry for the map
      const pts = JSON.parse(await body(req));
      const r = await fetch(`${OSRM}/route/v1/driving/${coords(pts)}?overview=full&geometries=geojson`);
      const d = await r.json();
      if (d.code !== "Ok") return json(res, 502, { error: d.message || d.code });
      return json(res, 200, d.routes[0].geometry);
    }
    const f = path.join(__dirname, "public", u.pathname === "/" ? "index.html" : path.normalize(u.pathname).replace(/^(\.\.[\/\\])+/, ""));
    fs.readFile(f, (e, data) => { if (e) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": types[path.extname(f)] || "text/plain" }); res.end(data); });
  } catch (e) { json(res, 500, { error: String(e) }); }
}).listen(PORT, () => console.log("Open http://localhost:" + PORT));
function body(req) { return new Promise(r => { let s = ""; req.on("data", c => s += c); req.on("end", () => r(s)); }); }

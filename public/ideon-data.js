/*!
 * Ideon Data SDK v1 · datos persistentes y usuarios para apps generadas por Ideonapp.
 * La página lo carga con <script src="/ideon-data.js" data-project="…" data-mode="live|demo|local">.
 *   live  → datos en la nube del proyecto, con inicio de sesión del equipo del cliente.
 *   demo  → vista previa: datos de ejemplo guardados solo en este navegador.
 *   local → archivo descargado (ZIP): igual que demo.
 * API (síncrona sobre una caché; la sincronización con el servidor ocurre en segundo plano):
 *   IdeonDB.ready().then(function (db) { … })
 *   db.all(col) · db.get(col, id) · db.find(col, fn) · db.count(col)
 *   db.insert(col, data) · db.update(col, id, patch) · db.remove(col, id) · db.increment(col, id, campo, delta)
 *   db.seed(col, registros) · db.sample(col, registros) · db.on('change', fn) · db.user · db.users() · db.logout()
 *   db.prospect(texto, {location, max}) · db.exportJSON() · db.downloadJSON(nombre) · db.mode · db.status
 */
(function () {
  "use strict";
  if (window.IdeonDB) return;

  var script = document.currentScript || document.querySelector("script[data-ideon-data]");
  var PROJECT = (script && script.getAttribute("data-project")) || "";
  var MODE = (script && script.getAttribute("data-mode")) || "local";
  if (MODE === "live" && !PROJECT) MODE = "local";
  var LANG = ((document.documentElement.getAttribute("lang") || navigator.language || "es").slice(0, 2).toLowerCase() === "en") ? "en" : "es";
  var API = "/api/apps/" + PROJECT;
  var KEY = "ideon-data:" + (PROJECT || location.pathname);
  var COL_RE = /^[a-z_][a-z0-9_]{0,39}$/;
  var ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var RESERVED = ["id", "createdAt", "updatedAt", "createdBy", "updatedBy"];

  var TXT = {
    es: {
      signIn: "Iniciar sesión", email: "Correo", password: "Contraseña", enter: "Entrar", wrong: "Correo o contraseña incorrectos.",
      tooMany: "Demasiados intentos. Espera unos minutos.", network: "No hay conexión con el servidor. Revisa tu internet.", retry: "Reintentar",
      notActive: "Esta aplicación aún no está activada.", suspended: "Esta aplicación está suspendida temporalmente por renovación pendiente.",
      saved: "Todo guardado", saving: "Guardando…", offline: "Sin conexión: los cambios se guardarán al volver", logout: "Cerrar sesión",
      changePw: "Cambiar contraseña", current: "Contraseña actual", next: "Nueva contraseña (mín. 8)", save: "Guardar", cancel: "Cancelar",
      pwChanged: "Contraseña actualizada.", pwWrong: "La contraseña actual no es correcta.", pwWeak: "La nueva contraseña debe tener al menos 8 caracteres.",
      rejected: "Un cambio no se pudo guardar y se descartó.", leave: "Hay cambios sin guardar.", demoUser: "Usuario de demostración",
      powered: "Datos seguros con Ideonapp", role: { admin: "Administrador", member: "Miembro" },
      quota: "Llegaste al límite mensual de búsquedas de prospección.", noSearches: "No quedan búsquedas de prospección. El dueño de la cuenta puede activar el plan o comprar búsquedas en Ideonapp (Publicar → Prospección con IA).", badQuery: "Escribe qué tipo de empresas buscas (mínimo 3 letras).",
      searchFailed: "No se pudo completar la búsqueda. Inténtalo de nuevo.", aiPreview: "La IA está disponible en la app publicada (en la vista previa no se usa).", aiLimit: "Se alcanzó el límite diario de uso de IA de esta app. Inténtalo mañana.", aiFailed: "La IA no pudo responder. Inténtalo de nuevo.", demoNote: "Resultado de ejemplo (vista previa): en la app real la IA busca en la web y cita la fuente.",
    },
    en: {
      signIn: "Sign in", email: "Email", password: "Password", enter: "Sign in", wrong: "Wrong email or password.",
      tooMany: "Too many attempts. Wait a few minutes.", network: "Can't reach the server. Check your connection.", retry: "Retry",
      notActive: "This application isn't activated yet.", suspended: "This application is temporarily suspended pending renewal.",
      saved: "All changes saved", saving: "Saving…", offline: "Offline: changes will be saved when you're back", logout: "Sign out",
      changePw: "Change password", current: "Current password", next: "New password (min. 8)", save: "Save", cancel: "Cancel",
      pwChanged: "Password updated.", pwWrong: "The current password is wrong.", pwWeak: "The new password must be at least 8 characters.",
      rejected: "A change couldn't be saved and was discarded.", leave: "There are unsaved changes.", demoUser: "Demo user",
      powered: "Data secured by Ideonapp", role: { admin: "Admin", member: "Member" },
      quota: "You've reached this month's prospecting search limit.", noSearches: "No prospecting searches left. The account owner can activate the plan or buy searches in Ideonapp (Publish → AI prospecting).", badQuery: "Type what kind of businesses you're looking for (3+ letters).",
      searchFailed: "The search couldn't be completed. Try again.", aiPreview: "AI is available in the published app (not in the preview).", aiLimit: "This app reached its daily AI limit. Try again tomorrow.", aiFailed: "The AI couldn't answer. Try again.", demoNote: "Sample result (preview): in the live app the AI searches the web and cites the source.",
    },
  }[LANG];

  // ------------------------------------------------------------------ utilidades
  var memory = {};
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch { return memory[k] || null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch { memory[k] = v; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch { delete memory[k]; } }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function nowIso() { return new Date().toISOString(); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else for (var i = 0; i < 16; i++) b[i] = Math.random() * 256;
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }
  function strip(d) { var o = clone(d && typeof d === "object" ? d : {}) || {}; RESERVED.forEach(function (k) { delete o[k]; }); return o; }
  function checkCol(c) { if (!COL_RE.test(String(c))) throw new Error("IdeonDB: colección no válida «" + c + "» (minúsculas, números y _)."); }
  function k(col, id) { return col + "/" + id; }

  // ------------------------------------------------------------------ caché y eventos
  var recs = {};          // "col/id" → { id, collection, data, createdAt, updatedAt, createdBy }
  var meta = { sampled: {}, seeded: {} };
  var listeners = { change: [], status: [] };
  var user = null;
  var status = "saved";
  function emit(ev, arg) { (listeners[ev] || []).slice().forEach(function (fn) { try { fn(arg); } catch (e) { console.error(e); } }); }
  function view(r) { var o = clone(r.data) || {}; o.id = r.id; o.createdAt = r.createdAt; o.updatedAt = r.updatedAt; o.createdBy = r.createdBy || null; return o; }
  function list(col) {
    return Object.keys(recs).map(function (x) { return recs[x]; }).filter(function (r) { return r.collection === col; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : (a.id < b.id ? -1 : 1); });
  }

  // ------------------------------------------------------------------ persistencia local (demo / local)
  function loadLocal() {
    try { var s = JSON.parse(lsGet(KEY) || "null"); if (s && s.v === 1) { recs = s.records || {}; meta = s.meta || meta; } } catch { /* datos dañados: se empieza de cero */ }
  }
  var saveTimer = null;
  function saveLocal() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { lsSet(KEY, JSON.stringify({ v: 1, records: recs, meta: meta })); }, 80); }

  // ------------------------------------------------------------------ red
  function req(method, path, body) {
    return fetch(API + path, {
      method: method, credentials: "same-origin", cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.error && j.error.code) || "http_" + r.status); e.status = r.status; e.code = j && j.error && j.error.code; e.detail = j && j.error && j.error.detail; throw e; }
        return j;
      });
    });
  }

  // ------------------------------------------------------------------ sincronización (live)
  var queue = [];          // operaciones pendientes de enviar
  var pending = {};        // "col/id" → nº de operaciones pendientes
  var flushing = false, flushTimer = null, retryDelay = 2000, since = null, pollTimer = null;
  function qKey() { return KEY + ":queue:" + (user ? user.id : "anon"); }
  function persistQueue() { if (MODE === "live" && user) { if (queue.length) lsSet(qKey(), JSON.stringify(queue)); else lsDel(qKey()); } }
  function setStatus(s) { if (s !== status) { status = s; emit("status", s); renderChip(); } }
  function track(op, delta) { var x = k(op.collection, op.id); pending[x] = (pending[x] || 0) + delta; if (pending[x] <= 0) delete pending[x]; }
  function enqueue(op) { queue.push(op); track(op, 1); persistQueue(); setStatus("saving"); schedule(150); }
  function schedule(ms) { clearTimeout(flushTimer); flushTimer = setTimeout(flush, ms); }

  function applyServer(r, changed, own) {
    var x = k(r.collection, r.id);
    if (!own && pending[x]) return;                 // hay cambios locales sin enviar: mandan los locales
    var cur = recs[x];
    if (!own && cur && r.updatedAt && cur.updatedAt && cur.updatedAt > r.updatedAt) return;
    if (r.deleted) { if (cur) { delete recs[x]; changed[r.collection] = 1; } return; }
    recs[x] = { id: r.id, collection: r.collection, data: r.data || {}, createdAt: r.createdAt, updatedAt: r.updatedAt, createdBy: r.createdBy || null };
    changed[r.collection] = 1;
  }

  function flush() {
    if (flushing || !queue.length || MODE !== "live") return;
    flushing = true;
    var batch = queue.slice(0, 100);
    req("POST", "/records", { ops: batch }).then(function (res) {
      queue.splice(0, batch.length);
      batch.forEach(function (op) { track(op, -1); });
      var changed = {};
      (res.results || []).forEach(function (r, i) {
        if (r && !r.error) { if (!pending[k(r.collection, r.id)]) applyServer(r, changed, true); }
        else console.warn("IdeonDB:", r && r.error, batch[i]);
      });
      persistQueue(); retryDelay = 2000; flushing = false;
      if (queue.length) flush(); else setStatus("saved");
    }).catch(function (err) {
      flushing = false;
      if (err && err.status === 401) { setStatus("offline"); showLogin().then(function () { flush(); }); return; }
      if (err && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429) {
        console.error("IdeonDB: lote rechazado", err, batch);
        queue.splice(0, batch.length); batch.forEach(function (op) { track(op, -1); }); persistQueue();
        toast(TXT.rejected); if (queue.length) schedule(50); else setStatus("saved");
        return;
      }
      setStatus("offline"); schedule(retryDelay); retryDelay = Math.min(retryDelay * 2, 30000);
    });
  }

  function poll() {
    if (MODE !== "live" || !user || document.hidden) return;
    req("GET", "/records" + (since ? "?since=" + encodeURIComponent(since) : "")).then(function (j) {
      var changed = {};
      (j.records || []).forEach(function (r) { applyServer(r, changed, false); });
      since = j.now || since;
      var cols = Object.keys(changed);
      if (cols.length) emit("change", { collections: cols, remote: true });
      if (status === "offline" && !queue.length) setStatus("saved");
    }).catch(function (e) { if (e && e.status === 401) showLogin(); });
  }
  function startPolling() {
    clearInterval(pollTimer); pollTimer = setInterval(poll, 8000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { poll(); flush(); } });
    window.addEventListener("online", function () { flush(); poll(); });
    window.addEventListener("beforeunload", function (e) { if (queue.length) { e.preventDefault(); e.returnValue = TXT.leave; return TXT.leave; } });
  }

  // ------------------------------------------------------------------ operaciones
  function applyLocal(op) {
    var x = k(op.collection, op.id), r = recs[x], t = nowIso();
    if (op.op === "insert") recs[x] = { id: op.id, collection: op.collection, data: clone(op.data), createdAt: (r && r.createdAt) || t, updatedAt: t, createdBy: user ? user.id : null };
    else if (op.op === "update" && r) { Object.keys(op.patch).forEach(function (f) { r.data[f] = clone(op.patch[f]); }); r.updatedAt = t; }
    else if (op.op === "increment" && r) { r.data[op.field] = (Number(r.data[op.field]) || 0) + op.delta; r.updatedAt = t; }
    else if (op.op === "remove") delete recs[x];
  }
  function commit(op) {
    applyLocal(op);
    if (MODE === "live") enqueue(op); else saveLocal();
  }
  function need(col, id) {
    checkCol(col); var r = recs[k(col, id)];
    if (!r) throw new Error("IdeonDB: no existe el registro " + col + "/" + id + ".");
    return r;
  }

  var db = {
    version: 1,
    mode: MODE,
    user: null,
    get status() { return status; },
    all: function (col) { checkCol(col); return list(col).map(view); },
    get: function (col, id) { checkCol(col); var r = recs[k(col, id)]; return r ? view(r) : null; },
    find: function (col, fn) { return db.all(col).filter(fn); },
    count: function (col) { checkCol(col); return list(col).length; },
    insert: function (col, data) {
      checkCol(col);
      var op = { op: "insert", collection: col, id: uuid(), data: strip(data) };
      commit(op); return view(recs[k(col, op.id)]);
    },
    update: function (col, id, patch) {
      need(col, id); var p = strip(patch); if (!Object.keys(p).length) return db.get(col, id);
      commit({ op: "update", collection: col, id: id, patch: p }); return db.get(col, id);
    },
    /** Crea o reemplaza el registro con ese id (útil para configuración: «settings/general»). */
    put: function (col, id, data) {
      checkCol(col); id = String(id);
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error("IdeonDB: id no válido «" + id + "».");
      var cur = recs[k(col, id)], d = strip(data);
      if (!cur) { commit({ op: "insert", collection: col, id: id, data: d }); return db.get(col, id); }
      var patch = {}; Object.keys(cur.data || {}).forEach(function (f) { if (!(f in d)) patch[f] = null; });
      Object.keys(d).forEach(function (f) { patch[f] = d[f]; });
      if (Object.keys(patch).length) commit({ op: "update", collection: col, id: id, patch: patch });
      return db.get(col, id);
    },
    remove: function (col, id) { need(col, id); commit({ op: "remove", collection: col, id: id }); return true; },
    increment: function (col, id, field, delta) {
      need(col, id); var d = Number(delta);
      if (!isFinite(d)) throw new Error("IdeonDB: el incremento debe ser un número.");
      if (RESERVED.indexOf(field) >= 0) throw new Error("IdeonDB: campo no válido «" + field + "».");
      commit({ op: "increment", collection: col, id: id, field: String(field), delta: d }); return db.get(col, id);
    },
    /** Configuración inicial (categorías, estados, bodegas…): se crea una sola vez, también en la app real. */
    seed: function (col, records) { return initial(col, records, "seeded"); },
    /** Datos de ejemplo: solo en la vista previa y en el archivo descargado, nunca en la app real. */
    sample: function (col, records) { if (MODE === "live") return []; return initial(col, records, "sampled"); },
    on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return function () { db.off(ev, fn); }; },
    off: function (ev, fn) { listeners[ev] = (listeners[ev] || []).filter(function (f) { return f !== fn; }); },
    users: function () {
      if (MODE !== "live") return Promise.resolve([{ id: "demo", name: TXT.demoUser, role: "admin" }]);
      return req("GET", "/users").then(function (j) { return j.users || []; });
    },
    logout: function () {
      if (MODE !== "live") return Promise.resolve();
      return req("POST", "/auth/logout").catch(function () {}).then(function () { lsDel(qKey()); location.reload(); });
    },
    /**
     * Prospección con IA: busca en la web empresas que encajan (p. ej. «ferreterías», {location: "Medellín"})
     * y devuelve sus datos de contacto corporativos con la fuente. Tarda hasta ~1 minuto.
     * En la vista previa devuelve ejemplos ficticios.
     */
    prospect: function (query, opts) {
      opts = opts || {};
      if (MODE !== "live") return demoProspects(String(query || ""), opts);
      return req("POST", "/prospect", { query: String(query || ""), location: opts.location || undefined, max: opts.max || 10 }).then(function (j) {
        return { results: j.results || [], remaining: j.remaining, demo: false };
      }, function (e) {
        var msg = e.code === "no_searches" ? TXT.noSearches : e.code === "quota_exceeded" ? TXT.quota : e.code === "invalid_query" ? TXT.badQuery : TXT.searchFailed;
        var err = new Error(msg); err.code = e.code; throw err;
      });
    },
    /**
     * IA para la app (solo en la app publicada y con sesión): db.ai("texto") → {text}; db.ai.json("…") → objeto/array.
     * opts.tier: "quick" (rápido y barato) o "default" (mejor calidad).
     */
    ai: aiCall,
    exportJSON: function () {
      var out = {}; Object.keys(recs).forEach(function (x) { var r = recs[x]; if (r.collection.indexOf("__") === 0) return; (out[r.collection] = out[r.collection] || []).push(view(r)); });
      return out;
    },
    downloadJSON: function (name) {
      var blob = new Blob([JSON.stringify({ exportedAt: nowIso(), collections: db.exportJSON() }, null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (name || "datos") + ".json"; document.body.appendChild(a); a.click(); a.remove();
    },
  };

  function aiCall(prompt, opts) { return aiReq(prompt, opts, false).then(function (j) { return { text: j.text || "" }; }); }
  aiCall.json = function (prompt, opts) { return aiReq(prompt, opts, true).then(function (j) { return j.json; }); };
  function aiReq(prompt, opts, json) {
    opts = opts || {};
    if (MODE !== "live") { var pe = new Error(TXT.aiPreview); pe.code = "preview_only"; return Promise.reject(pe); }
    var tier = opts.tier || (opts.modelTier === "quick" ? "quick" : "default");
    return req("POST", "/ai", { prompt: String(prompt || ""), json: json, tier: tier, system: opts.system || undefined }).catch(function (e) {
      var err = new Error(e.code === "ai_limit" ? TXT.aiLimit : TXT.aiFailed); err.code = e.code || "ai_failed"; err.detail = e.detail; if (e.detail) console.error("IdeonDB.ai:", e.detail); throw err;
    });
  }

  /** Vista previa: empresas ficticias con la forma real de los resultados. */
  function demoProspects(query, opts) {
    var city = opts.location || (LANG === "en" ? "Madrid" : "Bogotá");
    var kind = query.replace(/\s+en\s+.*$/i, "").trim() || (LANG === "en" ? "Business" : "Comercial");
    var Kind = kind.charAt(0).toUpperCase() + kind.slice(1);
    var names = ["Andina", "Del Valle", "Central", "La Esquina", "Horizonte", "El Puente", "Sol y Luna", "Nova", "Prado", "Altamira"];
    var n = Math.min(opts.max || 6, 8);
    var results = names.slice(0, n).map(function (nm, i) {
      var slug = (kind + "-" + nm).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
      return { empresa: Kind + " " + nm, sector: Kind, ciudad: city, direccion: (LANG === "en" ? "Fictional street " : "Calle ficticia ") + (10 + i * 7) + " # " + (20 + i) + "-" + (5 + i),
        telefono: "+57601555" + (1000 + i * 37), whatsapp: i % 2 ? "+57300555" + (2000 + i * 41) : "", correo: i % 3 === 2 ? "" : "contacto@" + slug + ".ejemplo.test",
        web: "https://" + slug + ".ejemplo.test/", fuente: "https://" + slug + ".ejemplo.test/contacto", nota: TXT.demoNote };
    });
    return new Promise(function (res) { setTimeout(function () { res({ results: results, remaining: null, demo: true }); }, 1200); });
  }

  function initial(col, records, kind) {
    checkCol(col);
    if (!Array.isArray(records) || !records.length) return [];
    var marker = "__ideon_" + kind;
    if (meta[kind][col] || recs[k("__ideon", marker + "_" + col)] || list(col).length) return [];
    meta[kind][col] = 1;
    var out = records.map(function (rec) {
      var id = rec && rec.id != null && ID_RE.test(String(rec.id)) ? String(rec.id) : uuid();
      var op = { op: "insert", collection: col, id: id, data: strip(rec) };
      commit(op); return view(recs[k(col, id)]);
    });
    // Marca para no volver a crearlos aunque el usuario los borre todos.
    commit({ op: "insert", collection: "__ideon", id: marker + "_" + col, data: { kind: kind, collection: col } });
    return out;
  }

  // ------------------------------------------------------------------ interfaz (Shadow DOM, aislada del CSS de la app)
  var host = null, root = null;
  var BRAND = { title: "", logo: "", accent: "", accent2: "", dark: false };
  function hex(c) { return /^#[0-9a-f]{3,8}$/i.test(c || "") ? c : ""; }
  function brandCss() {
    var a = hex(BRAND.accent), a2 = hex(BRAND.accent2) || a, out = [".logo{display:block;width:44px;height:44px;margin:0 0 14px;border-radius:12px}"];
    if (a) out.push(".pri{background:linear-gradient(135deg," + a + "," + a2 + ");color:#0b0a14}input:focus{outline-color:" + a + ";border-color:" + a + "}");
    if (BRAND.dark) out.push(".ov{background:radial-gradient(900px 500px at 15% 10%,rgba(139,124,246,.22),transparent),radial-gradient(800px 500px at 90% 95%,rgba(94,176,255,.16),transparent),#09090b}" +
      ".card{background:#131316;border-color:rgba(255,255,255,.09);color:#fafafa;box-shadow:0 30px 80px -30px rgba(0,0,0,.8)}h1{color:#fafafa}p{color:#a1a1aa}label{color:#d4d4d8}" +
      "input{background:#0f0f12;border-color:rgba(255,255,255,.12);color:#fafafa}.foot{color:#71717a}.err{color:#f87171}");
    return out.join("");
  }
  function ui() {
    if (root) return root;
    host = document.createElement("div"); host.setAttribute("data-ideon-data-ui", "");
    (document.body || document.documentElement).appendChild(host);
    root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var st = document.createElement("style"), bs = document.createElement("style");
    bs.textContent = brandCss();
    st.textContent = [
      ":host{all:initial}",
      "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}",
      ".ov{position:fixed;inset:0;z-index:2147483646;background:#f4f4f5;display:flex;align-items:center;justify-content:center;padding:16px}",
      ".card{width:100%;max-width:380px;background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.08);color:#18181b}",
      "h1{font-size:20px;margin:0 0 4px;font-weight:650}p{margin:0;color:#71717a;font-size:14px;line-height:1.45}",
      "label{display:block;margin-top:14px;font-size:13px;font-weight:550;color:#3f3f46}",
      "input{width:100%;margin-top:6px;height:42px;border:1px solid #d4d4d8;border-radius:10px;padding:0 12px;font-size:15px;color:#18181b;background:#fff}",
      "input:focus{outline:2px solid #6d5df5;outline-offset:1px;border-color:#6d5df5}",
      "button{cursor:pointer;border:0;border-radius:10px;height:42px;padding:0 16px;font-size:15px;font-weight:600}",
      ".pri{width:100%;margin-top:18px;background:#18181b;color:#fff}.pri[disabled]{opacity:.6;cursor:default}",
      ".ghost{background:transparent;color:#3f3f46;height:36px;font-size:14px;font-weight:500;text-align:left;width:100%;border-radius:8px;padding:0 10px}.ghost:hover{background:#f4f4f5}",
      ".err{color:#dc2626;font-size:13px;margin-top:10px;min-height:18px}.ok{color:#16a34a}",
      ".foot{margin-top:18px;font-size:11.5px;color:#a1a1aa;text-align:center}",
      ".chip{position:fixed;z-index:2147483645;right:12px;bottom:12px;display:flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 10px;border-radius:999px;background:rgba(24,24,27,.9);color:#fff;font-size:12.5px;font-weight:550;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer;border:0}",
      ".dot{width:8px;height:8px;border-radius:50%;background:#22c55e}.dot.saving{background:#f59e0b}.dot.offline{background:#ef4444}",
      ".menu{position:fixed;z-index:2147483645;right:12px;bottom:54px;width:250px;background:#fff;color:#18181b;border:1px solid #e4e4e7;border-radius:12px;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.15)}",
      ".who{padding:4px 10px 10px;border-bottom:1px solid #f4f4f5;margin-bottom:6px}.who b{display:block;font-size:14px}.who span{font-size:12.5px;color:#71717a}",
      ".st{font-size:12px;color:#71717a;padding:6px 10px}",
      ".toast{position:fixed;z-index:2147483647;left:50%;transform:translateX(-50%);bottom:20px;background:#18181b;color:#fff;padding:10px 16px;border-radius:10px;font-size:13.5px;box-shadow:0 6px 20px rgba(0,0,0,.25)}",
    ].join("");
    root.appendChild(st); bs.setAttribute("data-brand", ""); root.appendChild(bs);
    return root;
  }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var a in attrs || {}) e.setAttribute(a, attrs[a]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(msg) {
    var r = ui(), t = el("div", { class: "toast", role: "status" }); t.textContent = msg; r.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  var loginPromise = null;
  function showLogin() {
    if (loginPromise) return loginPromise;
    loginPromise = new Promise(function (resolve) {
      var r = ui();
      var ov = el("div", { class: "ov" });
      var title = esc(BRAND.title || document.title || "");
      ov.innerHTML = '<form class="card" novalidate>' + (BRAND.logo ? '<img class="logo" alt="" src="' + esc(BRAND.logo) + '">' : "") + '<h1>' + (title || TXT.signIn) + "</h1><p>" + TXT.signIn + "</p>" +
        '<label>' + TXT.email + '<input name="email" type="email" autocomplete="username" required></label>' +
        '<label>' + TXT.password + '<input name="password" type="password" autocomplete="current-password" required></label>' +
        '<div class="err" role="alert"></div><button class="pri" type="submit">' + TXT.enter + '</button><div class="foot">' + TXT.powered + "</div></form>";
      r.appendChild(ov);
      var form = ov.querySelector("form"), err = ov.querySelector(".err"), btn = ov.querySelector("button");
      setTimeout(function () { var i = form.querySelector("input"); if (i) i.focus(); }, 50);
      form.addEventListener("submit", function (e) {
        e.preventDefault(); err.textContent = ""; btn.disabled = true;
        req("POST", "/auth/login", { email: form.email.value, password: form.password.value }).then(function (j) {
          ov.remove(); loginPromise = null; resolve(j.user);
        }).catch(function (e2) {
          btn.disabled = false;
          err.textContent = e2.status === 429 ? TXT.tooMany : e2.status === 401 ? TXT.wrong : e2.status === 403 ? TXT.notActive : e2.status === 402 ? TXT.suspended : TXT.network;
        });
      });
    });
    return loginPromise;
  }

  function showFatal(message, retry) {
    var r = ui(), ov = el("div", { class: "ov" });
    ov.innerHTML = '<div class="card"><h1>' + esc(document.title || "") + "</h1><p>" + esc(message) + "</p>" + (retry ? '<button class="pri" type="button">' + TXT.retry + "</button>" : "") + "</div>";
    r.appendChild(ov);
    var b = ov.querySelector("button"); if (b) b.addEventListener("click", function () { location.reload(); });
  }

  var chip = null, menu = null;
  function renderChip() {
    if (MODE !== "live" || !user) return;
    var r = ui();
    if (!chip) {
      chip = el("button", { class: "chip", type: "button", "aria-haspopup": "menu" });
      chip.addEventListener("click", function () { if (menu) closeMenu(); else openMenu(); });
      r.appendChild(chip);
    }
    var initials = String(user.name || "?").split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase();
    chip.innerHTML = '<span class="dot ' + status + '"></span>' + esc(initials);
    chip.setAttribute("title", status === "saving" ? TXT.saving : status === "offline" ? TXT.offline : TXT.saved);
    if (menu) { var s = menu.querySelector(".st"); if (s) s.textContent = status === "saving" ? TXT.saving : status === "offline" ? TXT.offline : TXT.saved; }
  }
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu() {
    var r = ui(); closeMenu();
    menu = el("div", { class: "menu", role: "menu" });
    menu.innerHTML = '<div class="who"><b>' + esc(user.name) + "</b><span>" + esc(user.email || "") + " · " + esc(TXT.role[user.role] || user.role) + "</span></div>" +
      '<div class="st"></div><button class="ghost" data-a="pw" type="button">' + TXT.changePw + '</button><button class="ghost" data-a="out" type="button">' + TXT.logout + "</button>";
    r.appendChild(menu); renderChip();
    menu.addEventListener("click", function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "out") db.logout(); else if (a === "pw") { closeMenu(); changePassword(); }
    });
  }
  function changePassword() {
    var r = ui(), ov = el("div", { class: "ov", style: "background:rgba(0,0,0,.35)" });
    ov.innerHTML = '<form class="card" novalidate><h1>' + TXT.changePw + "</h1>" +
      '<label>' + TXT.current + '<input name="current" type="password" autocomplete="current-password"></label>' +
      '<label>' + TXT.next + '<input name="next" type="password" autocomplete="new-password" minlength="8"></label>' +
      '<div class="err" role="alert"></div><button class="pri" type="submit">' + TXT.save + '</button><button class="ghost" type="button" data-a="x" style="margin-top:8px;text-align:center">' + TXT.cancel + "</button></form>";
    r.appendChild(ov);
    var form = ov.querySelector("form"), err = ov.querySelector(".err");
    ov.querySelector("[data-a=x]").addEventListener("click", function () { ov.remove(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault(); err.textContent = "";
      if (form.next.value.length < 8) { err.textContent = TXT.pwWeak; return; }
      req("POST", "/auth/password", { current: form.current.value, next: form.next.value })
        .then(function () { ov.remove(); toast(TXT.pwChanged); })
        .catch(function (e2) { err.textContent = e2.code === "wrong_password" ? TXT.pwWrong : e2.code === "weak_password" ? TXT.pwWeak : TXT.network; });
    });
  }

  // ------------------------------------------------------------------ arranque
  var readyPromise = null;
  function boot() {
    if (MODE !== "live") {
      loadLocal();
      user = { id: "demo", name: TXT.demoUser, email: "", role: "admin" };
      db.user = user;
      return Promise.resolve(db);
    }
    return req("GET", "/me").then(function (j) { return j.user; }, function (e) {
      if (e.status === 401) return showLogin();
      throw e;
    }).then(function (u) {
      user = u; db.user = u;
      return req("GET", "/records");
    }).then(function (j) {
      var changed = {};
      (j.records || []).forEach(function (r) { applyServer(r, changed, true); });
      since = j.now;
      // Cambios que quedaron sin enviar (corte de conexión o recarga): se reaplican y se envían.
      try { JSON.parse(lsGet(qKey()) || "[]").forEach(function (op) { applyLocal(op); queue.push(op); track(op, 1); }); } catch { /* cola dañada */ }
      startPolling(); renderChip();
      if (queue.length) { setStatus("saving"); flush(); }
      return db;
    }).catch(function (e) {
      if (e && e.status === 403) showFatal(TXT.notActive, false);
      else if (e && e.status === 402) showFatal(TXT.suspended, false);
      else showFatal(TXT.network, true);
      throw e;
    });
  }

  window.IdeonDB = {
    version: 1,
    mode: MODE,
    /** Marca de la pantalla de acceso: {title, logo (URL o data:), accent, accent2, dark}. Llamar antes de ready(). */
    brand: function (b) { b = b || {}; ["title", "logo", "accent", "accent2"].forEach(function (k) { if (typeof b[k] === "string") BRAND[k] = b[k]; }); BRAND.dark = b.dark === true; if (root) { var x = root.querySelector("style[data-brand]"); if (x) x.textContent = brandCss(); } },
    ready: function () { if (!readyPromise) readyPromise = new Promise(function (res) { if (document.body) res(); else document.addEventListener("DOMContentLoaded", function () { res(); }); }).then(boot); return readyPromise; },
  };
})();

// ============================================================
//  BLUESTAR — SUPABASE DATABASE LAYER
//  Handles all reading and writing of works to Supabase.
//  app.js calls these functions instead of touching `works` directly.
// ============================================================

var db = (function() {

  // ── INIT SUPABASE CLIENT ────────────────────────────────────
  var client = null;

  function getClient() {
    if (client) return client;
    if (typeof supabase === 'undefined') {
      console.error('Supabase SDK not loaded.');
      return null;
    }
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false }
    });
    return client;
  }

  // ── LOAD ALL WORKS ──────────────────────────────────────────
  // Returns works sorted newest first.
  async function loadWorks() {
    var sb = getClient();
    if (!sb) return [];
    var { data, error } = await sb
      .from('works')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('loadWorks error:', error.message); return []; }
    return (data || []).map(dbRowToWork);
  }

  // ── SAVE A WORK ─────────────────────────────────────────────
  // Returns the saved work with its db id, or null on failure.
  async function saveWork(w) {
    var sb = getClient();
    if (!sb) return null;
    var row = workToDbRow(w);
    var { data, error } = await sb
      .from('works')
      .insert([row])
      .select()
      .single();
    if (error) { console.error('saveWork error:', error.message); return null; }
    return dbRowToWork(data);
  }

  // ── DELETE A WORK ───────────────────────────────────────────
  async function deleteWork(id) {
    var sb = getClient();
    if (!sb) return false;
    var { error } = await sb
      .from('works')
      .delete()
      .eq('id', id);
    if (error) { console.error('deleteWork error:', error.message); return false; }
    return true;
  }

  // ── SEED INITIAL WORKS ──────────────────────────────────────
  // Called once on first load if the table is empty.
  // Inserts the starter poems from data.js so the site isn't blank.
  async function seedIfEmpty(seedWorks) {
    var sb = getClient();
    if (!sb) return;
    var { count } = await sb
      .from('works')
      .select('id', { count: 'exact', head: true });
    if (count && count > 0) return; // already has data
    var rows = seedWorks.map(workToDbRow);
    var { error } = await sb.from('works').insert(rows);
    if (error) console.error('seed error:', error.message);
  }

  // ── ROW ↔ WORK CONVERTERS ───────────────────────────────────
  function workToDbRow(w) {
    return {
      title:   w.title,
      type:    w.type,
      lang:    w.lang,
      date:    w.date,
      excerpt: w.excerpt,
      content: w.content
    };
  }

  function dbRowToWork(row) {
    return {
      id:      row.id,         // supabase uuid — needed for delete
      title:   row.title,
      type:    row.type,
      lang:    row.lang,
      date:    row.date,
      excerpt: row.excerpt,
      content: row.content
    };
  }

  // ── PUBLIC API ───────────────────────────────────────────────
  return {
    loadWorks:   loadWorks,
    saveWork:    saveWork,
    deleteWork:  deleteWork,
    seedIfEmpty: seedIfEmpty
  };

})();

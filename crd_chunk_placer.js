// kubejs/server_scripts/crd_chunk_placer.js
// Places Cobblemon Raid Dens on chunk load near target logs, by weighted tier.

// ---------- CONFIG ----------
var CONFIG = {
  "minecraft:the_nether": {
    blocks: [
      "minecraft:crimson_stem","minecraft:warped_stem",
      "minecraft:stripped_crimson_stem","minecraft:stripped_warped_stem",
      "minecraft:crimson_hyphae","minecraft:warped_hyphae",
      "minecraft:stripped_crimson_hyphae","minecraft:stripped_warped_hyphae"
    ],
    chancePerChunk: 0.01,   // 1% roll when a chunk is first seen
    yScan: 48,              // how far to scan up/down to find air above the anchor
    triesPerChunk: 200,     // random samples inside the chunk to find an anchor
    argMode: "enum",        // "enum" -> TIER_* ; "numeric" -> "tier N"
    // weights: [T1..T7], any nonnegative numbers; zeros exclude tiers; normalized internally
    weights: [0, 0, 15, 30, 40, 10, 5]
  }
};
var DEFAULT_WEIGHTS = [20, 30, 32, 10, 5, 2, 1];
var TICK_INTERVAL = 40;     // run once every 40 ticks (~2s)
var DEBUG = true;
// ---------- END CONFIG ----------

// --- helpers ---
function round3(n){ return Math.floor(n*1000)/1000; }
function dbg(server,color,msg){
  if (!DEBUG) return;
  var s = String(msg).replace(/"/g,'\\"');
  server.runCommand('tellraw @a {"text":"'+s+'","color":"'+color+'"}');
}
function dimKey(d, cx, cz) {
  return "crd_chunk_done_" + String(d).toLowerCase().replace(/[^a-z0-9_]/g, "_") + "_" + cx + "_" + cz;
}
function pickTier(weights) {
  var w = (weights && weights.length === 7) ? weights.slice(0) : DEFAULT_WEIGHTS.slice(0);
  var i, sum = 0;
  for (i = 0; i < 7; i++) { var v = Number(w[i]); if (!(v >= 0)) v = 0; w[i] = v; sum += v; }
  if (sum <= 0) return -1;
  var r = Math.random() * sum, acc = 0;
  for (i = 0; i < 7; i++) { acc += w[i]; if (r < acc) return i + 1; }
  return 7;
}
function tierArg(mode, n) {
  if (n < 1 || n > 7) return "";
  if (mode === "numeric") return " tier " + n;
  var N = ["TIER_ONE","TIER_TWO","TIER_THREE","TIER_FOUR","TIER_FIVE","TIER_SIX","TIER_SEVEN"];
  return " tier " + N[n - 1]; // enum requires "tier "
}
function contains(arr, id) {
  for (var i = 0; i < arr.length; i++) if (arr[i] === id) return true;
  return false;
}
function tryFindAnchor(level, cfg, cx, cz) {
  var minY = 8, maxY = 126; // safe band for Nether
  var tries = Number(cfg.triesPerChunk) > 0 ? Number(cfg.triesPerChunk) : 160;
  var scan = Number(cfg.yScan) > 0 ? Number(cfg.yScan) : 32;

  for (var t = 0; t < tries; t++) {
    var x = (cx << 4) + Math.floor(Math.random() * 16);
    var z = (cz << 4) + Math.floor(Math.random() * 16);
    var y = minY + Math.floor(Math.random() * (maxY - minY + 1));

    var bid = String(level.getBlock(x, y, z).id);
    if (!contains(cfg.blocks, bid)) continue;

    // find air near anchor
    var yUp = y + 1, i = 0;
    while (i < scan && String(level.getBlock(x, yUp, z).id) !== "minecraft:air") { yUp++; i++; }
    if (String(level.getBlock(x, yUp, z).id) !== "minecraft:air") {
      var k = 0, yDn = y + 1;
      while (k < scan && String(level.getBlock(x, yDn, z).id) !== "minecraft:air") { yDn--; k++; }
      if (String(level.getBlock(x, yDn, z).id) !== "minecraft:air") continue;
      yUp = yDn;
    }
    return { x: x, y: yUp, z: z };
  }
  return null;
}

var tickCounter = 0;

ServerEvents.tick(function (event) {
  tickCounter++;
  if ((tickCounter % TICK_INTERVAL) !== 0) return;

  var server = event.server;
  var players = server.players;
  if (!players || players.size() === 0) return;

  var data = server.persistentData;

  for (var p = 0; p < players.size(); p++) {
    var pl = players.get(p);
    var dim = String(pl.level.dimension);
    var cfg = CONFIG[dim];
    if (!cfg) continue;

    var cx = (Math.floor(pl.x)) >> 4;
    var cz = (Math.floor(pl.z)) >> 4;
    var key = dimKey(dim, cx, cz);
    if (data[key]) continue; // processed

    data[key] = true; // mark regardless to keep it cheap

    var roll = Math.random();
    if (roll >= Number(cfg.chancePerChunk)) {
      dbg(server,"dark_gray","[CRD] Chunk "+cx+","+cz+" rolled no-den ("+round3(roll)+")");
      continue;
    }

    // use player's level object to read blocks
    var level = pl.level;
    var spot = tryFindAnchor(level, cfg, cx, cz);
    if (!spot) {
      dbg(server,"gold","[CRD] No anchor logs found in chunk "+cx+","+cz);
      continue;
    }

    var chosen = pickTier(cfg.weights);
    if (chosen === -1) {
      dbg(server,"red","[CRD] No selectable tiers (all zero)");
      continue;
    }

    var cmd = "/execute in " + dim + " run crd dens " + spot.x + " " + spot.y + " " + spot.z + tierArg(String(cfg.argMode), chosen);
    dbg(server,"yellow","[CRD] "+cmd+" (chunk "+cx+","+cz+", tier "+chosen+")");
    server.runCommand(cmd);
  }
});

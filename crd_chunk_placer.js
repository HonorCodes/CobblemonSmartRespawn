// kubejs/server_scripts/crd_chunk_placer_pad.js
// ES5-safe. Places Cobblemon Raid Dens on chunk load using a flat 3x3 ground pad with 3x3xH clear air above.

// ---------- CONFIG ----------
var CONFIG = {
  "minecraft:the_nether": {
    // allowed ground blocks for the 3x3 pad
    groundBlocks: [
      "regions_unexplored:cobalt_nylium",
      "regions_unexplored:mycotoxic_moss",
      "minecraft:netherrack",
      "minecraft:soul_sand","minecraft:soul_soil",
      "minecraft:basalt","minecraft:blackstone",
      "minecraft:crimson_nylium","minecraft:warped_nylium",
      "minecraft:magma_block"
    ],
    chancePerChunk: 0.01,    // roll once per newly seen chunk
    triesPerChunk: 200,      // random samples inside the chunk
    clearHeight: 12,         // clear 3x3xH air above the pad
    requireFlat3x3: true,    // all 9 pad blocks must be in groundBlocks on same Y
    argMode: "enum",         // "enum" -> TIER_* ; "numeric" -> "tier N"
    weights: [0, 0, 15, 30, 40, 10, 5],
    retryIfNoSpot: true      // if no pad found, try again next tick for this chunk
  }
};
var DEFAULT_WEIGHTS = [20, 30, 32, 10, 5, 2, 1];
var TICK_INTERVAL = 5;       // ~0.25 s
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
function contains(arr, id){
  for (var i=0;i<arr.length;i++) if (arr[i]===id) return true;
  return false;
}
function allPadGround(level, x,y,z, gs){
  var dx, dz, id;
  for (dx=-1; dx<=1; dx++){
    for (dz=-1; dz<=1; dz++){
      id = String(level.getBlock(x+dx, y, z+dz).id);
      if (!contains(gs, id)) return false;
    }
  }
  return true;
}
function padAirClear(level, x,y,z, h){
  var yy, dx, dz, id;
  for (yy=y+1; yy<=y+h; yy++){
    for (dx=-1; dx<=1; dx++){
      for (dz=-1; dz<=1; dz++){
        id = String(level.getBlock(x+dx, yy, z+dz).id);
        if (id !== "minecraft:air") return false;
      }
    }
  }
  return true;
}
function clearPadAir(level, x,y,z, h){
  var yy, dx, dz, id;
  for (yy=y+1; yy<=y+h; yy++){
    for (dx=-1; dx<=1; dx++){
      for (dz=-1; dz<=1; dz++){
        id = String(level.getBlock(x+dx, yy, z+dz).id);
        if (id !== "minecraft:air") level.setBlock(x+dx, yy, z+dz, "minecraft:air");
      }
    }
  }
}
function pickTier(weights){
  var w = (weights && weights.length===7) ? weights.slice(0) : DEFAULT_WEIGHTS.slice(0);
  var i, sum=0;
  for(i=0;i<7;i++){ var v=Number(w[i]); if(!(v>=0)) v=0; w[i]=v; sum+=v; }
  if (sum<=0) return -1;
  var r=Math.random()*sum, acc=0;
  for(i=0;i<7;i++){ acc+=w[i]; if(r<acc) return i+1; }
  return 7;
}
function tierArg(mode,n){
  if(n<1||n>7) return "";
  if(mode==="numeric") return " tier "+n;
  var N=["TIER_ONE","TIER_TWO","TIER_THREE","TIER_FOUR","TIER_FIVE","TIER_SIX","TIER_SEVEN"];
  return " tier "+N[n-1];
}

// Find a 3x3 pad on same Y of allowed ground with clear air above.
function findPad(level, cfg, cx, cz){
  var tries = Number(cfg.triesPerChunk)>0 ? Number(cfg.triesPerChunk) : 160;
  var h = Number(cfg.clearHeight)>0 ? Number(cfg.clearHeight) : 12;
  var gs = cfg.groundBlocks || [];
  var minY = 8, maxY = 126;

  for (var t=0; t<tries; t++){
    // keep 1-block margin so 3x3 fits inside chunk
    var x = (cx<<4) + 1 + Math.floor(Math.random()*14);
    var z = (cz<<4) + 1 + Math.floor(Math.random()*14);

    // scan downward to find first ground with air above
    var y, id, above;
    var startY = maxY - Math.floor(Math.random()*32); // vary start a bit
    if (startY<minY) startY=minY;
    for (y=startY; y>=minY; y--){
      id = String(level.getBlock(x, y, z).id);
      above = String(level.getBlock(x, y+1, z).id);
      if (contains(gs, id) && above==="minecraft:air") break;
    }
    if (y<minY) continue;

    // require all 3x3 to be in ground set if configured
    if (cfg.requireFlat3x3 && !allPadGround(level, x, y, z, gs)) continue;

    // require 3x3xH clear air above
    if (!padAirClear(level, x, y, z, h)) continue;

    return { x:x, y:y+1, z:z }; // place on top center
  }
  return null;
}

var tickCounter = 0;

ServerEvents.tick(function (event){
  tickCounter++;
  if ((tickCounter % TICK_INTERVAL) !== 0) return;

  var server = event.server;
  var players = server.players;
  if (!players || players.size()===0) return;

  var data = server.persistentData;

  for (var p=0; p<players.size(); p++){
    var pl = players.get(p);
    var dim = String(pl.level.dimension);
    var cfg = CONFIG[dim];
    if (!cfg) continue;

    var cx = (Math.floor(pl.x)) >> 4;
    var cz = (Math.floor(pl.z)) >> 4;
    var key = dimKey(dim, cx, cz);

    // only mark done after a roll that we choose not to retry
    if (data[key]) continue;

    var roll = Math.random();
    if (roll >= Number(cfg.chancePerChunk)) {
      dbg(server,"dark_gray","[CRD] Chunk "+cx+","+cz+" rolled no-den ("+round3(roll)+")");
      data[key] = true; // chance failed -> done
      continue;
    }

    var level = pl.level;
    var spot = findPad(level, cfg, cx, cz);
    if (!spot) {
      dbg(server,"gold","[CRD] No valid 3x3 pad in chunk "+cx+","+cz);
      if (!cfg.retryIfNoSpot) data[key] = true; // stop trying this chunk
      continue;
    }

    // clear space then place
    clearPadAir(level, spot.x, spot.y-1, spot.z, Number(cfg.clearHeight)>0?Number(cfg.clearHeight):12);

    var chosen = pickTier(cfg.weights);
    if (chosen === -1) {
      dbg(server,"red","[CRD] No selectable tiers (all zero)");
      data[key] = true;
      continue;
    }

    var cmd = "/execute in " + dim + " run crd dens " + spot.x + " " + spot.y + " " + spot.z + tierArg(String(cfg.argMode), chosen);
    dbg(server,"yellow","[CRD] "+cmd+" (chunk "+cx+","+cz+", tier "+chosen+")");
    server.runCommand(cmd);

    data[key] = true; // finished
  }
});

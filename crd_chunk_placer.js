// kubejs/server_scripts/crd_chunk_placer_pad.js
// ES5-safe. Places Cobblemon Raid Dens on chunk load using a flat 3x3 ground pad.

// ---------- CONFIG ----------
var CONFIG = {
  "minecraft:the_nether": {
    groundBlocks: [
      "regions_unexplored:cobalt_nylium",
      "regions_unexplored:mycotoxic_moss",
      "minecraft:netherrack",
      "minecraft:soul_sand","minecraft:soul_soil",
      "minecraft:basalt","minecraft:blackstone",
      "minecraft:crimson_nylium","minecraft:warped_nylium",
      "minecraft:magma_block"
    ],
    chancePerChunk: 0.05,
    triesPerChunk: 200,
    clearHeight: 12,
    requireFlat3x3: true,
    argMode: "enum",
    weights: [0, 0, 15, 30, 40, 10, 5],
    retryIfNoSpot: true,
    playSound: "minecraft:entity.experience_orb.pickup"
    // yMin/yMax can be added if needed
  },

  // Aether (Deep Aether surface blocks included here)
  "aether:the_aether": {
    groundBlocks: [
      // Aether
      "aether:grass_block","aether:aether_grass_block",
      "aether:aether_dirt","aether:holystone",
      "aether:quicksoil","aether:icestone",
      "aether:skyroot_log",
      // Deep Aether
      "deep_aether:deep_aether_grass_block","deep_aether:deep_aether_dirt",
      "deep_aether:abyssal_holystone","deep_aether:corrupted_quicksoil",
      "deep_aether:echoed_icestone"
    ],
    chancePerChunk: 0.05,
    triesPerChunk: 220,
    clearHeight: 12,
    requireFlat3x3: true,
    argMode: "enum",
    weights: [10, 20, 30, 20, 15, 4, 1],
    retryIfNoSpot: true,
    playSound: "minecraft:entity.experience_orb.pickup",
    yMin: 16,
    yMax: 255
  },

  // The End
  "minecraft:the_end": {
    groundBlocks: [
      "minecraft:end_stone",
      "minecraft:obsidian",
      "minecraft:end_stone_bricks",
      "minecraft:purpur_block",
      // Nullscape extras
      "minecraft:blackstone"
    ],
    chancePerChunk: 0.05,
    triesPerChunk: 220,
    clearHeight: 12,
    requireFlat3x3: true,
    argMode: "enum",
    // from your end weighting example
    weights: [0, 0, 5, 20, 30, 25, 20],
    retryIfNoSpot: true,
    playSound: "minecraft:entity.experience_orb.pickup",
    yMin: 0,
    yMax: 255
  },

  // Deeper & Darker — Otherside
  "deeperdarker:otherside": {
    groundBlocks: [
      "minecraft:sculk","deeperdarker:gloomy_sculk",
      "deeperdarker:sculk_stone","deeperdarker:gloomslate",
      "deeperdarker:skulk_grime","deeperdarker:scarc",
      "deeperdarker:aqua_soil","deeperdarker:skaric_stone"
    ],
    chancePerChunk: 0.05,
    triesPerChunk: 200,
    clearHeight: 12,
    requireFlat3x3: true,
    argMode: "enum",
    weights: [0, 0, 10, 20, 35, 25, 10],
    retryIfNoSpot: true,
    playSound: "minecraft:entity.experience_orb.pickup"
  },

  // Allthemodium — The Other
  "allthemodium:the_other": {
    groundBlocks: [
      "minecraft:netherrack",
      "minecraft:soul_sand","minecraft:soul_soil",
      "minecraft:magma_block","minecraft:gravel",
      "minecraft:basalt","minecraft:blackstone",
      "minecraft:crimson_nylium","minecraft:warped_nylium",
      "minecraft:glowstone","minecraft:nether_quartz_ore",
      "allthemodium:vibranium_ore"
    ],
    chancePerChunk: 0.05,
    triesPerChunk: 200,
    clearHeight: 12,
    requireFlat3x3: true,
    argMode: "enum",
    // nether-like weighting; adjust as needed
    weights: [0, 0, 15, 30, 40, 10, 5],
    retryIfNoSpot: true,
    playSound: "minecraft:entity.experience_orb.pickup"
  }
};

var DEFAULT_WEIGHTS = [20, 30, 32, 10, 5, 2, 1];
var TICK_INTERVAL = 5;             // ~0.25 s
var DEBUG_VERBOSE = true;         // debug spam on/off (announce always on)
// ---------- END CONFIG ----------

// --- helpers ---
function round3(n){ return Math.floor(n*1000)/1000; }
function esc(s){ return String(s).replace(/\\/g,"\\\\").replace(/"/g,'\\"'); }
function dbg(server,color,msg){
  if (!DEBUG_VERBOSE) return;
  server.runCommand('tellraw @a {"text":"'+esc(msg)+'","color":"'+color+'"}');
}
function dimKey(d, cx, cz) {
  return "crd_chunk_done_" + String(d).toLowerCase().replace(/[^a-z0-9_]/g, "_") + "_" + cx + "_" + cz;
}
function contains(arr, id){ for (var i=0;i<arr.length;i++) if (arr[i]===id) return true; return false; }

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

// name + nearest player helpers
function getPlayerName(pl){
  if (!pl) return "player";
  if (pl.username) return String(pl.username);
  if (pl.name) {
    if (typeof pl.name.getString === "function") return String(pl.name.getString());
    if (typeof pl.name.string === "string") return String(pl.name.string);
    if (typeof pl.name === "string") return String(pl.name);
  }
  if (pl.displayName) {
    if (typeof pl.displayName.getString === "function") return String(pl.displayName.getString());
    if (typeof pl.displayName.string === "string") return String(pl.displayName.string);
  }
  return "player";
}
function nearestPlayer(server, dim, spot, maxR){
  var players = server.players;
  var best = null, bestD2 = 1e18, i, pl, dx, dy, dz, d2;
  for (i=0;i<players.size();i++){
    pl = players.get(i);
    if (String(pl.level.dimension) !== String(dim)) continue;
    dx = pl.x - spot.x; dy = pl.y - spot.y; dz = pl.z - spot.z;
    d2 = dx*dx + dy*dy + dz*dz;
    if (d2 < bestD2) { bestD2 = d2; best = pl; }
  }
  if (best && maxR && bestD2 > maxR*maxR) return null;
  return best;
}
function niceDimName(dim){
  var d = String(dim);
  if (d === "minecraft:the_nether") return "The Nether";
  if (d === "minecraft:overworld")   return "The Overworld";
  if (d === "minecraft:the_end")     return "The End";
  if (d === "aether:the_aether")     return "The Aether";
  if (d === "deeperdarker:otherside") return "The Otherside";
  if (d === "allthemodium:the_other") return "The Other";
  var p = d.indexOf(":")>=0 ? d.split(":")[1] : d;
  p = p.replace(/_/g, " ");
  return p.replace(/\b\w/g, function(c){ return c.toUpperCase(); });
}
function notifySpawn(server, pl, tier, spot, cfg){
  var dim = pl && pl.level ? String(pl.level.dimension) : "minecraft:overworld";
  var near = nearestPlayer(server, dim, spot, 256) || pl;
  var name = getPlayerName(near);
  var payload = {
    "text": "",
    "extra": [
      {"text":"[Raid Den] ","color":"white"},
      {"text": String(tier), "color":"light_purple"},
      {"text":"-star raid den has spawned in ","color":"white"},
      {"text": niceDimName(dim), "color":"yellow"},
      {"text":", near ","color":"white"},
      {"text": name, "color":"green"},
      {"text":"!","color":"white"}
    ]
  };
  server.runCommand('tellraw @a ' + JSON.stringify(payload));
  var snd = cfg.playSound;
  if (snd) {
    server.runCommand('playsound '+String(snd)+' master @a '+Math.floor(spot.x)+' '+Math.floor(spot.y)+' '+Math.floor(spot.z)+' 0.6 1.0');
  }
}

// Find a 3x3 pad on same Y of allowed ground with clear air above.
function findPad(level, cfg, cx, cz){
  var tries = Number(cfg.triesPerChunk)>0 ? Number(cfg.triesPerChunk) : 160;
  var h = Number(cfg.clearHeight)>0 ? Number(cfg.clearHeight) : 12;
  var gs = cfg.groundBlocks || [];
  var minY = typeof cfg.yMin === "number" ? cfg.yMin : 8;
  var maxY = typeof cfg.yMax === "number" ? cfg.yMax : 126;

  for (var t=0; t<tries; t++){
    var x = (cx<<4) + 1 + Math.floor(Math.random()*14);
    var z = (cz<<4) + 1 + Math.floor(Math.random()*14);

    // scan downward to find first ground with air above
    var y, id, above;
    var startY = maxY - Math.floor(Math.random()*32);
    if (startY<minY) startY=minY;
    for (y=startY; y>=minY; y--){
      id = String(level.getBlock(x, y, z).id);
      above = String(level.getBlock(x, y+1, z).id);
      if (contains(gs, id) && above==="minecraft:air") break;
    }
    if (y<minY) continue;

    if (cfg.requireFlat3x3 && !allPadGround(level, x, y, z, gs)) continue;
    if (!padAirClear(level, x, y, z, h)) continue;

    return { x:x, y:y+1, z:z };
  }
  return null;
}

// --- main loop ---
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

    if (data[key]) continue;

    var roll = Math.random();
    if (roll >= Number(cfg.chancePerChunk)) {
      dbg(server,"dark_gray","[CRD] Chunk "+cx+","+cz+" rolled no-den ("+round3(roll)+")");
      data[key] = true;
      continue;
    }

    var level = pl.level;
    var spot = findPad(level, cfg, cx, cz);
    if (!spot) {
      dbg(server,"gold","[CRD] No valid 3x3 pad in chunk "+cx+","+cz);
      if (!cfg.retryIfNoSpot) data[key] = true;
      continue;
    }

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

    notifySpawn(server, pl, chosen, spot, cfg);

    data[key] = true;
  }
});

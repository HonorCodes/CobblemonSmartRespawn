// --- Cobblemon Smart Respawn (player-radius pseudo-cap) --------------------
// NeoForge 1.21.1 + KubeJS (Rhino build.77) safe: no Java.type, no for-of, etc.

// Tunables
var CHECK_FREQUENCY_TICKS = 20 * 30;      // 30s
var SPAWN_SENSITIVITY    = 4.0;           // pseudo-cap = diameterInChunks * this
var MAX_ALIVE_TICKS      = 20 * 60 * 3;   // 3 minutes

// Paths to cobblemon config (first one that exists will be used)
var COBBLE_CFG_PATHS = [
  'config/cobblemon/main.json',
  'config/cobblmon/main.json' // fallback if pack uses the old typo
];

// Species that must never be culled (from your command)
var PROTECTED_SPECIES = [
  // Kanto
  'cobblemon:articuno','cobblemon:zapdos','cobblemon:moltres','cobblemon:mew','cobblemon:mewtwo',
  // Johto
  'cobblemon:raikou','cobblemon:entei','cobblemon:suicune','cobblemon:lugia','cobblemon:hooh','cobblemon:celebi',
  // Hoenn
  'cobblemon:regirock','cobblemon:regice','cobblemon:registeel','cobblemon:latias','cobblemon:latios',
  'cobblemon:kyogre','cobblemon:groudon','cobblemon:rayquaza','cobblemon:jirachi','cobblemon:deoxys',
  // Sinnoh
  'cobblemon:uxie','cobblemon:mesprit','cobblemon:azelf','cobblemon:dialga','cobblemon:palkia','cobblemon:heatran',
  'cobblemon:regigigas','cobblemon:giratina','cobblemon:cresselia','cobblemon:phione','cobblemon:manaphy',
  'cobblemon:darkrai','cobblemon:shaymin','cobblemon:arceus',
  // Unova
  'cobblemon:victini','cobblemon:cobalion','cobblemon:terrakion','cobblemon:virizion',
  'cobblemon:tornadus','cobblemon:thundurus','cobblemon:landorus','cobblemon:reshiram','cobblemon:zekrom',
  'cobblemon:kyurem','cobblemon:keldeo','cobblemon:meloetta',
  // Kalos
  'cobblemon:xerneas','cobblemon:yveltal','cobblemon:zygarde','cobblemon:diancie','cobblemon:hoopa','cobblemon:volcanion',
  // Alola
  'cobblemon:tapukoko','cobblemon:tapulele','cobblemon:tapubulu','cobblemon:tapufini',
  'cobblemon:typenull','cobblemon:silvally','cobblemon:cosmog','cobblemon:necrozma','cobblemon:magearna','cobblemon:marshadow',
  // LGPE/Meltan line
  'cobblemon:zeraora','cobblemon:meltan','cobblemon:melmetal',
  // Galar
  'cobblemon:zacian','cobblemon:zamazenta','cobblemon:eternatus','cobblemon:kubfu','cobblemon:urshifu','cobblemon:zarude',
  'cobblemon:regieleki','cobblemon:regidrago','cobblemon:glastrier','cobblemon:spectrier','cobblemon:calyrex',
  // Hisui
  // (none in your list; leave blank)
  // Paldea
  'cobblemon:enamorus','cobblemon:wochien','cobblemon:chienpao','cobblemon:tinglu','cobblemon:chiyu',
  'cobblemon:koraidon','cobblemon:miraidon','cobblemon:okidogi','cobblemon:munkidori','cobblemon:fezandipiti',
  'cobblemon:ogerpon','cobblemon:terapagos','cobblemon:pecharunt',
  // Ultra Beasts
  'cobblemon:nihilego','cobblemon:buzzwole','cobblemon:pheromosa','cobblemon:xurkitree','cobblemon:celesteela',
  'cobblemon:kartana','cobblemon:guzzlord','cobblemon:poipole','cobblemon:naganadel','cobblemon:stakataka','cobblemon:blacephalon',
  // Paradox
  'cobblemon:greattusk','cobblemon:screamtail','cobblemon:brutebonnet','cobblemon:fluttermane','cobblemon:slitherwing',
  'cobblemon:sandyshocks','cobblemon:irontreads','cobblemon:ironbundle','cobblemon:ironhands','cobblemon:ironjugulis',
  'cobblemon:ironmoth','cobblemon:ironthorns','cobblemon:roaringmoon','cobblemon:ironvaliant','cobblemon:walkingwake',
  'cobblemon:ironleaves','cobblemon:gougingfire','cobblemon:ragingbolt','cobblemon:ironboulder','cobblemon:ironcrown'
];

function readCobbleDistances() {
  var i, p, cfg, maxD = 96.0, minD = 12.0;
  for (i = 0; i < COBBLE_CFG_PATHS.length; i++) {
    p = COBBLE_CFG_PATHS[i];
    try {
      cfg = JsonIO.read(p);
      if (cfg) {
        if (typeof cfg.maximumSliceDistanceFromPlayer === 'number') maxD = cfg.maximumSliceDistanceFromPlayer;
        if (typeof cfg.minimumSliceDistanceFromPlayer === 'number') minD = cfg.minimumSliceDistanceFromPlayer;
        break;
      }
    } catch (e) {
      // ignore and try next path
    }
  }
  return { max: maxD, min: minD };
}

function isProtectedPokemon(e) {
  // e is EntityJS for type cobblemon:pokemon
  var nbt = e.fullNBT;
  // Named?
  if (nbt && nbt.CustomName != null) return true;
  // NoAI?
  if (nbt && (nbt.NoAI === 1 || nbt.NoAI === true)) return true;

  // Pokemon sub-compound may not exist if something is weird; treat missing as protected.
  if (!nbt || !nbt.Pokemon) return true;

  var poke = nbt.Pokemon;

  // Tamed check (same as your command selects ONLY wild with OriginalTrainerType:"NONE")
  if (poke.PokemonOriginalTrainerType && poke.PokemonOriginalTrainerType !== 'NONE') return true;

  // Shiny?
  if (poke.Shiny === 1 || poke.Shiny === true) return true;

  // Legendary/UB/Paradox species
  if (poke.Species && PROTECTED_SPECIES.indexOf(String(poke.Species)) >= 0) return true;

  return false;
}

var CSR_TICK = 0;

// Track first-seen tick for each Pokémon so we can age them without touching Java internals
EntityEvents.spawned(event => {
  var ent = event.entity;
  if (!ent || String(ent.type) !== 'cobblemon:pokemon') return;
  try {
    if (ent.persistentData.csrFirstSeen == null) {
      ent.persistentData.csrFirstSeen = CSR_TICK;
    }
  } catch (e) {
    // ignore
  }
});

ServerEvents.tick(event => {
  CSR_TICK = CSR_TICK + 1;
  if (CSR_TICK % CHECK_FREQUENCY_TICKS !== 0) return;

  var s = event.server;
  var distCfg = readCobbleDistances();
  var maxDist = distCfg.max;
  var minDist = distCfg.min;

  // pseudo-cap based on your formula
  var diameterChunks = (maxDist - minDist) / 16.0;
  var pseudoCap = Math.floor(diameterChunks * SPAWN_SENSITIVITY);
  if (pseudoCap < 1) pseudoCap = 1;

  // Get players as entities (JS array)
  var players = s.getEntities('@a');
  var pi, pj, p, selector, mons, i, e, nbt, seen, age, oldest, oldestAge, candidates, killed;

  for (pi = 0; pi < players.length; pi++) {
    p = players[pi];

    // Gather Pokémon around this player within maxDist
    selector = '@e[type=cobblemon:pokemon,x=' + Math.floor(p.x) +
               ',y=' + Math.floor(p.y) +
               ',z=' + Math.floor(p.z) +
               ',distance=..' + maxDist + ']';

    mons = s.getEntities(selector);

    // Stamp first-seen tick if missing
    for (i = 0; i < mons.length; i++) {
      e = mons[i];
      if (e.persistentData.csrFirstSeen == null) {
        e.persistentData.csrFirstSeen = CSR_TICK;
      }
    }

    // Cull logic only if over pseudo-cap
    if (mons.length > pseudoCap) {
      candidates = [];
      for (i = 0; i < mons.length; i++) {
        e = mons[i];
        if (isProtectedPokemon(e)) continue;

        seen = e.persistentData.csrFirstSeen;
        if (seen == null) seen = CSR_TICK; // very new
        age = CSR_TICK - seen;
        if (age >= MAX_ALIVE_TICKS) {
          candidates.push(e);
        }
      }

      if (candidates.length > 0) {
        // find oldest by our tracked age
        oldest = null;
        oldestAge = -1;
        for (i = 0; i < candidates.length; i++) {
          e = candidates[i];
          seen = e.persistentData.csrFirstSeen;
          if (seen == null) seen = CSR_TICK;
          age = CSR_TICK - seen;
          if (age > oldestAge) {
            oldestAge = age;
            oldest = e;
          }
        }

        if (oldest != null) {
          var onbt = oldest.fullNBT;
          var species = (onbt && onbt.Pokemon && onbt.Pokemon.Species) ? String(onbt.Pokemon.Species) : '(unknown)';
          var dim = String(oldest.level.dimension);
          var pos = Math.floor(oldest.x) + ' ' + Math.floor(oldest.y) + ' ' + Math.floor(oldest.z);

          // final safety check
          if (!isProtectedPokemon(oldest)) {
            oldest.kill();
            console.info('[CSR] Culled ' + species + ' at ' + pos + ' in ' + dim +
                         ' (range ' + Math.floor(maxDist) + ', count ' + mons.length +
                         ' > cap ' + pseudoCap + ', age ' + oldestAge + ' ticks).');
          }
        }
      }
    }
  }
});

// Cobblemon Smart Respawn
// NeoForge 1.21.1 + KubeJS (Rhino build.77)

// Many of the following options have *20
// DO NOT change this value unless you know what you are doing
var CHECK_FREQUENCY_TICKS = 20 * 30;      // Run every 30s; change the 30.
var SPAWN_SENSITIVITY    = 4.0;           // Pseudo-cap = diameterInChunks * this; lower = MORE sensitive
var MAX_ALIVE_TICKS      = 20 * 60 * 3;   // Cull only if alive > 3 minutes; change the 3.
var CULL_PER_CHECK       = 5;             // Kill up to this many per sweep

var COBBLE_CFG_PATHS = [
  'config/cobblemon/main.json',
  'config/cobblmon/main.json'
];

var PROTECTED_SPECIES = [
  'cobblemon:articuno','cobblemon:zapdos','cobblemon:moltres','cobblemon:mew','cobblemon:mewtwo',
  'cobblemon:raikou','cobblemon:entei','cobblemon:suicune','cobblemon:lugia','cobblemon:hooh','cobblemon:celebi',
  'cobblemon:regirock','cobblemon:regice','cobblemon:registeel','cobblemon:latias','cobblemon:latios',
  'cobblemon:kyogre','cobblemon:groudon','cobblemon:rayquaza','cobblemon:jirachi','cobblemon:deoxys',
  'cobblemon:uxie','cobblemon:mesprit','cobblemon:azelf','cobblemon:dialga','cobblemon:palkia','cobblemon:heatran',
  'cobblemon:regigigas','cobblemon:giratina','cobblemon:cresselia','cobblemon:phione','cobblemon:manaphy',
  'cobblemon:darkrai','cobblemon:shaymin','cobblemon:arceus',
  'cobblemon:victini','cobblemon:cobalion','cobblemon:terrakion','cobblemon:virizion',
  'cobblemon:tornadus','cobblemon:thundurus','cobblemon:landorus','cobblemon:reshiram','cobblemon:zekrom',
  'cobblemon:kyurem','cobblemon:keldeo','cobblemon:meloetta',
  'cobblemon:xerneas','cobblemon:yveltal','cobblemon:zygarde','cobblemon:diancie','cobblemon:hoopa','cobblemon:volcanion',
  'cobblemon:tapukoko','cobblemon:tapulele','cobblemon:tapubulu','cobblemon:tapufini',
  'cobblemon:typenull','cobblemon:silvally','cobblemon:cosmog','cobblemon:necrozma','cobblemon:magearna','cobblemon:marshadow',
  'cobblemon:zeraora','cobblemon:meltan','cobblemon:melmetal',
  'cobblemon:zacian','cobblemon:zamazenta','cobblemon:eternatus','cobblemon:kubfu','cobblemon:urshifu','cobblemon:zarude',
  'cobblemon:regieleki','cobblemon:regidrago','cobblemon:glastrier','cobblemon:spectrier','cobblemon:calyrex',
  'cobblemon:enamorus','cobblemon:wochien','cobblemon:chienpao','cobblemon:tinglu','cobblemon:chiyu',
  'cobblemon:koraidon','cobblemon:miraidon','cobblemon:okidogi','cobblemon:munkidori','cobblemon:fezandipiti',
  'cobblemon:ogerpon','cobblemon:terapagos','cobblemon:pecharunt',
  'cobblemon:nihilego','cobblemon:buzzwole','cobblemon:pheromosa','cobblemon:xurkitree','cobblemon:celesteela',
  'cobblemon:kartana','cobblemon:guzzlord','cobblemon:poipole','cobblemon:naganadel','cobblemon:stakataka','cobblemon:blacephalon',
  'cobblemon:greattusk','cobblemon:screamtail','cobblemon:brutebonnet','cobblemon:fluttermane','cobblemon:slitherwing',
  'cobblemon:sandyshocks','cobblemon:irontreads','cobblemon:ironbundle','cobblemon:ironhands','cobblemon:ironjugulis',
  'cobblemon:ironmoth','cobblemon:ironthorns','cobblemon:roaringmoon','cobblemon:ironvaliant','cobblemon:walkingwake',
  'cobblemon:ironleaves','cobblemon:gougingfire','cobblemon:ragingbolt','cobblemon:ironboulder','cobblemon:ironcrown'
];

function readCobbleDistances() {
  var maxD = 96.0, minD = 12.0;
  for (var i = 0; i < COBBLE_CFG_PATHS.length; i++) {
    try {
      var cfg = JsonIO.read(COBBLE_CFG_PATHS[i]);
      if (cfg) {
        if (typeof cfg.maximumSliceDistanceFromPlayer === 'number') maxD = cfg.maximumSliceDistanceFromPlayer;
        if (typeof cfg.minimumSliceDistanceFromPlayer === 'number') minD = cfg.minimumSliceDistanceFromPlayer;
        break;
      }
    } catch (e) {}
  }
  return { max: maxD, min: minD };
}

function isProtectedPokemon(e) {
  var nbt = e.fullNBT;
  if (nbt && nbt.CustomName != null) return true;
  if (nbt && (nbt.NoAI === 1 || nbt.NoAI === true)) return true;

  if (!nbt || !nbt.Pokemon) return true;
  var poke = nbt.Pokemon;

  if (poke.PokemonOriginalTrainerType && poke.PokemonOriginalTrainerType !== 'NONE') return true;
  if (poke.Shiny === 1 || poke.Shiny === true) return true;
  if (poke.Species && PROTECTED_SPECIES.indexOf(String(poke.Species)) >= 0) return true;

  return false;
}

var CSR_TICK = 0;

EntityEvents.spawned(function (event) {
  var ent = event.entity;
  if (!ent || String(ent.type) !== 'cobblemon:pokemon') return;
  if (ent.persistentData.csrFirstSeen == null) {
    ent.persistentData.csrFirstSeen = CSR_TICK;
  }
});

ServerEvents.tick(function (event) {
  CSR_TICK++;
  if (CSR_TICK % CHECK_FREQUENCY_TICKS !== 0) return;

  var s = event.server;
  var distCfg = readCobbleDistances();
  var maxDist = distCfg.max;
  var minDist = distCfg.min;

  var diameterChunks = (maxDist - minDist) / 16.0;
  var pseudoCap = Math.floor(diameterChunks * SPAWN_SENSITIVITY);
  if (pseudoCap < 1) pseudoCap = 1;

  var players = s.getEntities('@a');
  for (var pi = 0; pi < players.length; pi++) {
    var p = players[pi];

    var selector = '@e[type=cobblemon:pokemon,x=' + Math.floor(p.x) +
                   ',y=' + Math.floor(p.y) + ',z=' + Math.floor(p.z) +
                   ',distance=..' + maxDist + ']';

    var mons = s.getEntities(selector);

    for (var i = 0; i < mons.length; i++) {
      var e = mons[i];
      if (e.persistentData.csrFirstSeen == null) e.persistentData.csrFirstSeen = CSR_TICK;
    }

    if (mons.length > pseudoCap) {
      var candidates = [];
      for (var i = 0; i < mons.length; i++) {
        var e = mons[i];
        if (isProtectedPokemon(e)) continue;
        var seen = e.persistentData.csrFirstSeen || CSR_TICK;
        var age = CSR_TICK - seen;
        if (age >= MAX_ALIVE_TICKS) candidates.push({ ent: e, age: age });
      }

      if (candidates.length > 0) {
        candidates.sort(function (a, b) { return b.age - a.age; });

        var needed = mons.length - pseudoCap;
        var toKill = CULL_PER_CHECK;
        if (toKill > needed) toKill = needed;
        if (toKill > candidates.length) toKill = candidates.length;

        for (var i = 0; i < toKill; i++) {
          var target = candidates[i].ent;
          if (isProtectedPokemon(target)) continue;
          target.kill();
          var onbt = target.fullNBT;
          var species = (onbt && onbt.Pokemon && onbt.Pokemon.Species) ? String(onbt.Pokemon.Species) : '(unknown)';
          var dim = String(target.level.dimension);
          var pos = Math.floor(target.x) + ' ' + Math.floor(target.y) + ' ' + Math.floor(target.z);
          console.info('[CSR] Culled ' + species + ' at ' + pos + ' in ' + dim +
                       ' (count ' + mons.length + ' > cap ' + pseudoCap + ', age ' + candidates[i].age + ').');
        }
      }
    }
  }
});

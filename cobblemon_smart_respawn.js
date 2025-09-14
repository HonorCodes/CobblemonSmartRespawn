// --- ONLY CHANGE THESE VALUES! ---------------------------------------------
var checkFrequencyTicks = 20 * 30;        // run every 30s; do not change "20 *"
var spawnSensitivity    = 3;               // multiplier for pseudo-cap
var maxAliveTimeTicks   = 20 * 60 * 3;     // 3 minutes; do not change "20 * 60"
var cullsPerCheck       = 3;               // how many to remove per pass
// ---------------------------------------------------------------------------

// NOTE:
// Message user "Honor" on the offical Cobblemon Discord
// if there are any issues with this script.

var _cobbleCfg = null;

function readCobbleCfg() {
  if (_cobbleCfg !== null) return _cobbleCfg;

  var obj = {};
  try {
    // <root>/config/cobblemon/main.json
    obj = JsonIO.read('config/cobblemon/main.json') || {};
  } catch (e) {
    console.warn('[SmartRespawn] Could not read Cobblemon config, using defaults: ' + e);
    obj = {};
  }

  var spawning = obj.spawning || {};
  var minDist = Number(spawning.minimumSliceDistanceFromPlayer != null ? spawning.minimumSliceDistanceFromPlayer : 12);
  var maxDist = Number(spawning.maximumSliceDistanceFromPlayer != null ? spawning.maximumSliceDistanceFromPlayer : 96);

  _cobbleCfg = { minDist: minDist, maxDist: maxDist };
  return _cobbleCfg;
}

var COBBLEMON_TYPE_ID = 'cobblemon:pokemon';

// Species protected (legendaries, mythicals, ultra beasts, paradox, etc.)
var PROTECTED_SPECIES = [
  // Kanto birds + mythicals
  'cobblemon:articuno','cobblemon:zapdos','cobblemon:moltres','cobblemon:mew','cobblemon:mewtwo',
  // Johto beasts
  'cobblemon:raikou','cobblemon:entei','cobblemon:suicune',
  // Gen 2+3+4 legends/mythicals
  'cobblemon:lugia','cobblemon:hooh','cobblemon:celebi','cobblemon:regirock','cobblemon:regice',
  'cobblemon:registeel','cobblemon:latias','cobblemon:latios','cobblemon:kyogre','cobblemon:groudon',
  'cobblemon:rayquaza','cobblemon:jirachi','cobblemon:deoxys','cobblemon:uxie','cobblemon:mesprit',
  'cobblemon:azelf','cobblemon:dialga','cobblemon:palkia','cobblemon:heatran','cobblemon:regigigas',
  'cobblemon:giratina','cobblemon:cresselia','cobblemon:phione','cobblemon:manaphy','cobblemon:darkrai',
  'cobblemon:shaymin','cobblemon:arceus',
  // Gen 5
  'cobblemon:victini','cobblemon:cobalion','cobblemon:terrakion','cobblemon:virizion','cobblemon:tornadus',
  'cobblemon:thundurus','cobblemon:landorus','cobblemon:reshiram','cobblemon:zekrom','cobblemon:kyurem',
  'cobblemon:keldeo','cobblemon:meloetta',
  // Gen 6
  'cobblemon:xerneas','cobblemon:yveltal','cobblemon:zygarde','cobblemon:diancie','cobblemon:hoopa',
  'cobblemon:volcanion',
  // Gen 7 + UBs
  'cobblemon:tapukoko','cobblemon:tapulele','cobblemon:tapubulu','cobblemon:tapufini','cobblemon:typenull',
  'cobblemon:silvally','cobblemon:cosmog','cobblemon:necrozma','cobblemon:magearna','cobblemon:marshadow',
  'cobblemon:zeraora','cobblemon:meltan','cobblemon:melmetal',
  'cobblemon:nihilego','cobblemon:buzzwole','cobblemon:pheromosa','cobblemon:xurkitree','cobblemon:celesteela',
  'cobblemon:kartana','cobblemon:guzzlord','cobblemon:poipole','cobblemon:naganadel','cobblemon:stakataka',
  'cobblemon:blacephalon',
  // Gen 8
  'cobblemon:zacian','cobblemon:zamazenta','cobblemon:eternatus','cobblemon:kubfu','cobblemon:urshifu',
  'cobblemon:zarude','cobblemon:regieleki','cobblemon:regidrago','cobblemon:glastrier','cobblemon:spectrier',
  'cobblemon:calyrex',
  // Gen 9 + paradox
  'cobblemon:enamorus','cobblemon:wochien','cobblemon:chienpao','cobblemon:tinglu','cobblemon:chiyu',
  'cobblemon:koraidon','cobblemon:miraidon','cobblemon:okidogi','cobblemon:munkidori','cobblemon:fezandipiti',
  'cobblemon:ogerpon','cobblemon:terapagos','cobblemon:pecharunt',
  'cobblemon:greattusk','cobblemon:screamtail','cobblemon:brutebonnet','cobblemon:fluttermane','cobblemon:slitherwing',
  'cobblemon:sandyshocks','cobblemon:irontreads','cobblemon:ironbundle','cobblemon:ironhands',
  'cobblemon:ironjugulis','cobblemon:ironmoth','cobblemon:ironthorns','cobblemon:roaringmoon','cobblemon:ironvaliant',
  'cobblemon:walkingwake','cobblemon:ironleaves','cobblemon:gougingfire','cobblemon:ragingbolt',
  'cobblemon:ironboulder','cobblemon:ironcrown'
];

function isCobblemon(entity) {
  return entity && entity.type === COBBLEMON_TYPE_ID;
}

function isProtected(entity) {
  if (!entity) return false;

  // Never touch named Pokémon
  if (entity.customName) return true;

  // Read Cobblemon NBT safely
  var nbt = entity.fullNBT;
  if (!nbt || !nbt.contains('Pokemon')) return false;

  var p = nbt.get('Pokemon');

  // Tamed/owned check (original trainer present)
  if (p.contains('PokemonOriginalTrainerType') && p.getString('PokemonOriginalTrainerType') !== 'NONE') {
    return true;
  }

  // Shiny check
  if (p.contains('Shiny') && p.getBoolean('Shiny')) return true;

  // Boss flag
  if ((p.contains('IsBoss') && p.getBoolean('IsBoss')) || (p.contains('Boss') && p.getBoolean('Boss'))) {
    return true;
  }

  // Legendary / UB / Paradox species whitelist
  if (p.contains('Species') && PROTECTED_SPECIES.indexOf(p.getString('Species')) !== -1) {
    return true;
  }

  return false;
}

// Distance^2 helper (avoid sqrt)
function dist2(a, b) {
  var dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

var tickCounter = 0;

ServerEvents.tick(function (event) {
  var level = event.server.overworld(); // run once per tick using overworld as the driver
  if (!level) return;

  tickCounter++;
  if (tickCounter % checkFrequencyTicks !== 0) return;

  var cfg = readCobbleCfg();
  var minDist = cfg.minDist;
  var maxDist = cfg.maxDist;

  // Convert to squared distances for comparisons
  var maxDist2 = maxDist * maxDist;

  // Chunk window diameter in chunks
  var diameterChunks = Math.max(1, Math.floor((maxDist - minDist) / 16));
  var pseudoCap = diameterChunks * spawnSensitivity;

  var players = level.players;
  if (!players || players.length === 0) return;

  // Process around each player independently
  for (var i = 0; i < players.length; i++) {
    var player = players[i];
    var pPos = player.position();

    // Gather nearby Cobblemon
    var all = level.getEntities();
    var nearby = [];
    for (var j = 0; j < all.length; j++) {
      var e = all[j];
      if (!isCobblemon(e)) continue;
      if (dist2(e.position(), pPos) <= maxDist2) nearby.push(e);
    }

    // Over cap? decide how many to cull this pass
    if (nearby.length > pseudoCap) {
      // Filter candidates: not protected & old enough
      var cand = [];
      for (var k = 0; k < nearby.length; k++) {
        var ent = nearby[k];
        var age = ent.age != null ? ent.age : 0;
        if (!isProtected(ent) && age >= maxAliveTimeTicks) cand.push(ent);
      }

      // Oldest first
      cand.sort(function (a, b) { return (b.age || 0) - (a.age || 0); });

      var toCull = Math.min(cullsPerCheck, cand.length);
      for (var m = 0; m < toCull; m++) {
        var ent2 = cand[m];
        if (typeof ent2.discard === 'function') ent2.discard();
        else if (typeof ent2.kill === 'function') ent2.kill();
      }

      if (toCull > 0) {
        console.log('[SmartRespawn] ' + player.name.string + ': culled ' + toCull +
          ' Cobblemon (had ' + nearby.length + ', cap ' + pseudoCap + ').');
      }
    }
  }
});




// --- Tunables ---------------------------------------------------------------
const checkFrequencyTicks = 20 * 30;        // run every 30s
const spawnSensitivity    = 3;               // multiplier for pseudo-cap
const maxAliveTimeTicks   = 20 * 60 * 3;     // 3 minutes
const cullsPerCheck       = 3;               // how many to remove per pass
// ---------------------------------------------------------------------------

let _cobbleCfg = null;

function readCobbleCfg() {
  if (_cobbleCfg !== null) return _cobbleCfg;

  let obj = {};
  try {
    // Pull server config
    obj = JsonIO.read('config/cobblemon/main.json') || {};
  } catch (e) {
    console.warn('[SmartRespawn] Could not read Cobblemon config, using defaults: ' + e);
    obj = {};
  }

  // Safely pull distances; fall back to sensible defaults if missing
  const spawning = obj.spawning || {};
  const minDist = Number(spawning.minimumSliceDistanceFromPlayer ?? 12);
  const maxDist = Number(spawning.maximumSliceDistanceFromPlayer ?? 96);

  _cobbleCfg = { minDist, maxDist };
  return _cobbleCfg;
}

const COBBLEMON_TYPE_ID = 'cobblemon:pokemon';

// Species protected (legendaries, mythicals, ultra beasts, paradox, etc.)
const PROTECTED_SPECIES = new Set([
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
]);

function isCobblemon(entity) {
  return entity && entity.type === COBBLEMON_TYPE_ID;
}

function isProtected(entity) {
  if (!entity) return false;

  // Never touch named Pokémon
  if (entity.customName) return true;

  // Read Cobblemon NBT safely
  const nbt = entity.fullNBT;
  if (!nbt || !nbt.contains('Pokemon')) return false;

  const p = nbt.get('Pokemon');

  // Tamed/owned check
  if (p.contains('PokemonOriginalTrainerType') && p.getString('PokemonOriginalTrainerType') !== 'NONE') {
    return true;
  }

  // Shiny check
  if (p.contains('Shiny') && p.getBoolean('Shiny')) return true;

  // Boss flag (some builds use 'IsBoss', some 'Boss')
  if ((p.contains('IsBoss') && p.getBoolean('IsBoss')) || (p.contains('Boss') && p.getBoolean('Boss'))) {
    return true;
  }

  // Legendary / UB / Paradox species whitelist
  if (p.contains('Species') && PROTECTED_SPECIES.has(p.getString('Species'))) {
    return true;
  }

  return false;
}

// Distance^2
function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

let tickCounter = 0;

ServerEvents.tick(event => {
  const level = event.server.overworld(); // run once per tick using overworld as the driver
  if (!level) return;

  tickCounter++;
  if (tickCounter % checkFrequencyTicks !== 0) return;

  const cfg = readCobbleCfg();
  const minDist = (cfg?.spawning?.minimumSliceDistanceFromPlayer ?? 12) * 1.0;
  const maxDist = (cfg?.spawning?.maximumSliceDistanceFromPlayer ?? 96) * 1.0;

  // Convert to squared distances for comparisons
  const maxDist2 = maxDist * maxDist;

  // Chunk window diameter in chunks
  const diameterChunks = Math.max(1, Math.floor((maxDist - minDist) / 16));
  const pseudoCap = diameterChunks * spawnSensitivity;

  const players = level.players;
  if (!players || players.length === 0) return;

  // Process around each player independently
  for (const player of players) {
    const pPos = player.position();

    // Gather nearby Cobblemon
    const nearby = level.getEntities().filter(e => {
      if (!isCobblemon(e)) return false;
      // distance filter
      return dist2(e.position(), pPos) <= maxDist2;
    });

    // Over cap? decide how many to cull this pass
    if (nearby.length > pseudoCap) {
      // Filter candidates: not protected & old enough
      const now = nearby
        .filter(e => !isProtected(e) && (e.age ?? 0) >= maxAliveTimeTicks)
        .sort((a, b) => (b.age ?? 0) - (a.age ?? 0)); // oldest first

      const toCull = Math.min(cullsPerCheck, now.length);
      for (let i = 0; i < toCull; i++) {
        const ent = now[i];
        // prefer discard() if available (no drops/XP), fallback to kill()
        if (typeof ent.discard === 'function') ent.discard();
        else if (typeof ent.kill === 'function') ent.kill();
      }

      if (toCull > 0) {
        console.log(`[SmartRespawn] ${player.name.string}: culled ${toCull} Cobblemon (had ${nearby.length}, cap ${pseudoCap}).`);
      }
    }
  }
});

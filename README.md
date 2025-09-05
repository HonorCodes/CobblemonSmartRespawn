# CobblemonSmartRespawn
### Quick KubeJS scripts that "intelligenty" respawn cobblemon.

Specifically, I wanted to create something that would be able to respawn/destroy cobblemon regardless of the enabled option:
  "savePokemonToWorld": true,
And also avoid using an @kill command, like CobbleSweeper does (which is disruptive, drops loot, and makes death sounds).

## I've added a few variables for anyone to adjust:
// Calculate frequency of checks. Turn this up if you're experiencing tick-lag.
// Do not change the "20 *" unless you know what you're doing--this is to calculate for the tick times
// Default: 20 * 30;
CHECK_FREQUENCY_TICKS 

// Cobblemon psuedo-spawncap. Since there's no real "spawncap" for cobblemon, I've
// calculated it via:
// (("maximumSliceDistanceFromPlayer"-"minimumSliceDistanceFromPlayer")/16) * SPAWN_SENSITIVITY
// where those variables are grabbed from the user's cobblemon/main.js config for spawn range.
// A lower value will decrease the amount of Cobblemon needed within the user's maximumSliceDistanceFromPlayer
// needed to trigger an entity-age check
// Default: 4.0;
SPAWN_SENSITIVITY

// If the psuedo-spawncap is reached, check to see if there is an entity over the  minute age
// defined by this variable. If they are older than this, then they will get culled,
// assuming they are not on the PROTECTED_SPECIES list.
// Do not change the "20 * 60 *", unless you know what you're doing
// Default: 20 * 60 * 3;
MAX_ALIVE_TICKS

// Amount of cobblemon able to be culled per-check.
// It will be rare that you'll hit this number, unless your spawn ticks are VERY aggressive.
// Default: 5;
CULL_PER_CHECK

// Paths for Cobblemon config files
COBBLE_CFG_PATHS

// Cobblemon to protect.
// By default, I've included shinies, legendaries, owned, and cobblemon you're in a fight with.
PROTECTED_SPECIES

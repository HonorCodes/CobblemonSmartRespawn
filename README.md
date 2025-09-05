# CobblemonSmartRespawn

### Intelligent Cobblemon Respawning with KubeJS

CobblemonSmartRespawn provides KubeJS scripts to intelligently respawn or remove Cobblemon entities, regardless of whether `"savePokemonToWorld": true` is enabled in your configuration. Unlike solutions like CobbleSweeper, this approach avoids using disruptive commands such as `@kill` which cause loot drops and death sounds.

## Customizable Variables

Several variables are available for user adjustment:

### Check Frequency

Controls how often the script checks for Cobblemon entities. Increase this value if you experience server tick lag.  
**Default:** `CHECK_FREQUENCY_TICKS = 20 * 30;` (do not change the `20 *` unless you're familiar with Minecraft tick timings)

### Spawn Sensitivity

Estimates a pseudo-spawn cap, since Cobblemon does not have a true spawn cap. The cap is calculated using:
`( {maximumSliceDistanceFromPlayer} - {minimumSliceDistanceFromPlayer} / 16 ) * {SPAWN_SENSITIVITY}`
where these values are fetched from your Cobblemon `main.js` config. Lower sensitivity reduces the number of Cobblemon near the player required to trigger entity age checks.  
**Default:** `SPAWN_SENSITIVITY = 4.0`

### Maximum Alive Ticks

If the pseudo-spawn cap is reached, entities older than the specified tick limit are culled—unless they are part of the protected species list.  
**Default:** `MAX_ALIVE_TICKS = 20 * 60 * 3;` (do not modify the `20 * 60 *` unless you understand Minecraft tick timings)

### Cull Amount Per Check

Sets the number of Cobblemon that may be removed each check. You’ll rarely reach this limit unless spawn checks are extremely frequent.  
**Default:** `CULL_PER_CHECK = 5;`

### Configuration Paths

Specify the paths for your Cobblemon configuration files.  
Example: `COBBLE_CFG_PATHS`

### Protected Species

Defines Cobblemon protected from culling. The default list includes shinies, legendaries, owned Cobblemon, and those currently in battle.  
Example: `PROTECTED_SPECIES`

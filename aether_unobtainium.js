// NeoForge 1.21.x + LootJS 3.x
LootJS.lootTables(event => {
	event
		.modifyLootTables(/aether:chests\/.*/)     // all Aether chest tables
		.createPool(pool => {
			pool.addEntry(
				LootEntry.of('allthemodium:unobtainium_smithing_template')
					.randomChance(0.05)             // 5% per chest
			)
		})
})

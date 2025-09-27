// Block natural Moa spawns
EntityEvents.checkSpawn(function (e) {
	if (String(e.entity.type) === "aether:moa") e.cancel();
});

// Purge any Moas that load from chunks or are force-spawned
ServerEvents.tick(function (e) {
	// every 5 seconds
	if (e.server.getTickCount() % 100 === 0) {
		e.server.runCommandSilent('kill @e[type=aether:moa]');
	}
});

// Remove any crafting for Moa eggs
ServerEvents.recipes(function (e) {
	e.remove({ output: /aether:.*moa.*egg.*/ });
});

// kubejs/server_scripts/disable_mekanism_recipes.js
ServerEvents.recipes(event => {
	for (const id of [
		'mekanism:jetpack',
		'mekanism:jetpack_armored',
		'mekanism:flamethrower',
		'mekanism:mekasuit_helmet',
		'mekanism:mekasuit_bodyarmor',
		'mekanism:mekasuit_pants',
		'mekanism:mekasuit_boots'
	]) event.remove({ output: id });
});

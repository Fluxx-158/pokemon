CREATE TABLE `metadata` (
	`id` int NOT NULL,
	`last_pokeapi_sync` timestamp,
	`last_pc_overlay_sync` timestamp,
	`last_mega_evolutions_seed` timestamp,
	`pc_patch_version` varchar(32),
	CONSTRAINT `metadata_id` PRIMARY KEY(`id`)
);

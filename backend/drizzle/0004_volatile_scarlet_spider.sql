CREATE TABLE `pokemon_abilities` (
	`pokemon_id` int NOT NULL,
	`slot` int NOT NULL,
	`ability_id` int NOT NULL,
	`is_hidden` tinyint NOT NULL DEFAULT 0,
	CONSTRAINT `pokemon_abilities_pokemon_id_slot_pk` PRIMARY KEY(`pokemon_id`,`slot`)
);
--> statement-breakpoint
CREATE TABLE `pokemon_moves` (
	`pokemon_id` int NOT NULL,
	`move_id` int NOT NULL,
	`learn_method` varchar(16) NOT NULL,
	`level_learned_at` int NOT NULL DEFAULT 0,
	`pc_available` tinyint NOT NULL DEFAULT 1,
	`pc_notes` text,
	CONSTRAINT `pokemon_moves_pokemon_id_move_id_pk` PRIMARY KEY(`pokemon_id`,`move_id`)
);
--> statement-breakpoint
CREATE TABLE `pokemon` (
	`id` int NOT NULL,
	`species_id` int NOT NULL,
	`name` varchar(96) NOT NULL,
	`display_name` varchar(96) NOT NULL,
	`type1_id` int NOT NULL,
	`type2_id` int,
	`base_hp` int NOT NULL,
	`base_atk` int NOT NULL,
	`base_def` int NOT NULL,
	`base_spa` int NOT NULL,
	`base_spd` int NOT NULL,
	`base_spe` int NOT NULL,
	`bst` int NOT NULL,
	`height` int NOT NULL,
	`weight` int NOT NULL,
	`generation` int,
	`is_default` tinyint NOT NULL DEFAULT 0,
	`is_mega` tinyint NOT NULL DEFAULT 0,
	`is_regional` tinyint NOT NULL DEFAULT 0,
	`region_variant` varchar(16),
	`pc_available` tinyint NOT NULL DEFAULT 1,
	`pc_notes` text,
	CONSTRAINT `pokemon_id` PRIMARY KEY(`id`),
	CONSTRAINT `pokemon_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `pokemon_abilities` ADD CONSTRAINT `pokemon_abilities_pokemon_id_pokemon_id_fk` FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pokemon_abilities` ADD CONSTRAINT `pokemon_abilities_ability_id_abilities_id_fk` FOREIGN KEY (`ability_id`) REFERENCES `abilities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pokemon_moves` ADD CONSTRAINT `pokemon_moves_pokemon_id_pokemon_id_fk` FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pokemon_moves` ADD CONSTRAINT `pokemon_moves_move_id_moves_id_fk` FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pokemon` ADD CONSTRAINT `pokemon_type1_id_types_id_fk` FOREIGN KEY (`type1_id`) REFERENCES `types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pokemon` ADD CONSTRAINT `pokemon_type2_id_types_id_fk` FOREIGN KEY (`type2_id`) REFERENCES `types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_pa_ability` ON `pokemon_abilities` (`ability_id`);--> statement-breakpoint
CREATE INDEX `idx_pm_move` ON `pokemon_moves` (`move_id`);--> statement-breakpoint
CREATE INDEX `idx_pokemon_species` ON `pokemon` (`species_id`);--> statement-breakpoint
CREATE INDEX `idx_pokemon_type1` ON `pokemon` (`type1_id`);--> statement-breakpoint
CREATE INDEX `idx_pokemon_type2` ON `pokemon` (`type2_id`);
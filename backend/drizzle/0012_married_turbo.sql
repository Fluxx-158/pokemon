CREATE TABLE `pokemon_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pokemon_id` int NOT NULL,
	`format` varchar(8) NOT NULL,
	`category` varchar(16) NOT NULL,
	`rank` int NOT NULL,
	`name` varchar(96) NOT NULL DEFAULT '',
	`ref_id` int,
	`percentage` float,
	`nature_up` varchar(12),
	`nature_down` varchar(12),
	`ev_hp` int,
	`ev_atk` int,
	`ev_def` int,
	`ev_spa` int,
	`ev_spd` int,
	`ev_spe` int,
	CONSTRAINT `pokemon_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `metadata` ADD `last_usage_sync` timestamp;--> statement-breakpoint
ALTER TABLE `metadata` ADD `usage_source_generated_at` varchar(40);--> statement-breakpoint
ALTER TABLE `pokemon_usage` ADD CONSTRAINT `pokemon_usage_pokemon_id_pokemon_id_fk` FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_usage_pokemon_format` ON `pokemon_usage` (`pokemon_id`,`format`);--> statement-breakpoint
CREATE INDEX `idx_usage_pokemon_format_cat` ON `pokemon_usage` (`pokemon_id`,`format`,`category`);--> statement-breakpoint
CREATE INDEX `idx_usage_ref` ON `pokemon_usage` (`category`,`ref_id`);
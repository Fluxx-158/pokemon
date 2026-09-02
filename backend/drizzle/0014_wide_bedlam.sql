CREATE TABLE `meta_species` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pokemon_id` int NOT NULL,
	`format` varchar(8) NOT NULL,
	`raw_name` varchar(96) NOT NULL DEFAULT '',
	`limitless_decklists` int,
	`limitless_usage_pct` float,
	`limitless_team_win_pct` float,
	`limitless_wins` int,
	`limitless_losses` int,
	`top_teammates` text,
	`pikalytics_win_pct` float,
	`pikalytics_record` varchar(48),
	`pikalytics_data_date` varchar(16),
	`updated_at` timestamp,
	CONSTRAINT `meta_species_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_meta_species` UNIQUE(`pokemon_id`,`format`)
);
--> statement-breakpoint
ALTER TABLE `metadata` ADD `last_tournament_sync` timestamp;--> statement-breakpoint
ALTER TABLE `metadata` ADD `tournament_sample_decklists` int;--> statement-breakpoint
ALTER TABLE `metadata` ADD `tournament_count` int;--> statement-breakpoint
ALTER TABLE `metadata` ADD `last_winrate_sync` timestamp;--> statement-breakpoint
ALTER TABLE `metadata` ADD `winrate_source_data_date` varchar(16);--> statement-breakpoint
ALTER TABLE `meta_species` ADD CONSTRAINT `meta_species_pokemon_id_pokemon_id_fk` FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_meta_usage` ON `meta_species` (`format`,`limitless_usage_pct`);
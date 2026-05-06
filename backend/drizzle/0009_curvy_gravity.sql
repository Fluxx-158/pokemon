CREATE TABLE `team_member_evs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team_member_id` int NOT NULL,
	`hp` int NOT NULL DEFAULT 0,
	`atk` int NOT NULL DEFAULT 0,
	`def` int NOT NULL DEFAULT 0,
	`spa` int NOT NULL DEFAULT 0,
	`spd` int NOT NULL DEFAULT 0,
	`spe` int NOT NULL DEFAULT 0,
	CONSTRAINT `team_member_evs_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_member_evs_team_member_id_unique` UNIQUE(`team_member_id`)
);
--> statement-breakpoint
CREATE TABLE `team_member_ivs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team_member_id` int NOT NULL,
	`hp` int NOT NULL DEFAULT 31,
	`atk` int NOT NULL DEFAULT 31,
	`def` int NOT NULL DEFAULT 31,
	`spa` int NOT NULL DEFAULT 31,
	`spd` int NOT NULL DEFAULT 31,
	`spe` int NOT NULL DEFAULT 31,
	CONSTRAINT `team_member_ivs_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_member_ivs_team_member_id_unique` UNIQUE(`team_member_id`)
);
--> statement-breakpoint
CREATE TABLE `team_member_moves` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team_member_id` int NOT NULL,
	`slot` int NOT NULL,
	`move_id` int NOT NULL,
	CONSTRAINT `team_member_moves_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_tmm_member_slot` UNIQUE(`team_member_id`,`slot`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team_id` int NOT NULL,
	`slot` int NOT NULL,
	`pokemon_id` int NOT NULL,
	`ability_id` int NOT NULL,
	`item_id` int,
	`nature` varchar(16) NOT NULL,
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_tm_team_slot` UNIQUE(`team_id`,`slot`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`source_folder` varchar(255) NOT NULL,
	`notes` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `teams_source_folder_unique` UNIQUE(`source_folder`)
);
--> statement-breakpoint
ALTER TABLE `team_member_evs` ADD CONSTRAINT `team_member_evs_team_member_id_team_members_id_fk` FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_member_ivs` ADD CONSTRAINT `team_member_ivs_team_member_id_team_members_id_fk` FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_member_moves` ADD CONSTRAINT `team_member_moves_team_member_id_team_members_id_fk` FOREIGN KEY (`team_member_id`) REFERENCES `team_members`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_member_moves` ADD CONSTRAINT `team_member_moves_move_id_moves_id_fk` FOREIGN KEY (`move_id`) REFERENCES `moves`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_pokemon_id_pokemon_id_fk` FOREIGN KEY (`pokemon_id`) REFERENCES `pokemon`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_ability_id_abilities_id_fk` FOREIGN KEY (`ability_id`) REFERENCES `abilities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_item_id_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_tmm_move` ON `team_member_moves` (`move_id`);--> statement-breakpoint
CREATE INDEX `idx_tm_pokemon` ON `team_members` (`pokemon_id`);
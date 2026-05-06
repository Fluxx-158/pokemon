CREATE TABLE `mega_evolutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`base_pokemon_id` int NOT NULL,
	`mega_pokemon_id` int NOT NULL,
	`mega_stone_id` int NOT NULL,
	`notes` text,
	CONSTRAINT `mega_evolutions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_me_base_stone` UNIQUE(`base_pokemon_id`,`mega_stone_id`),
	CONSTRAINT `uq_me_mega` UNIQUE(`mega_pokemon_id`)
);
--> statement-breakpoint
ALTER TABLE `mega_evolutions` ADD CONSTRAINT `mega_evolutions_base_pokemon_id_pokemon_id_fk` FOREIGN KEY (`base_pokemon_id`) REFERENCES `pokemon`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mega_evolutions` ADD CONSTRAINT `mega_evolutions_mega_pokemon_id_pokemon_id_fk` FOREIGN KEY (`mega_pokemon_id`) REFERENCES `pokemon`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mega_evolutions` ADD CONSTRAINT `mega_evolutions_mega_stone_id_items_id_fk` FOREIGN KEY (`mega_stone_id`) REFERENCES `items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_me_stone` ON `mega_evolutions` (`mega_stone_id`);
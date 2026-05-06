CREATE TABLE `items` (
	`id` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`display_name` varchar(64) NOT NULL,
	`category` varchar(64) NOT NULL,
	`cost` int NOT NULL DEFAULT 0,
	`fling_power` int,
	`short_effect` text,
	`effect` text,
	`is_holdable` tinyint NOT NULL DEFAULT 0,
	`pc_available` tinyint NOT NULL DEFAULT 1,
	`pc_notes` text,
	CONSTRAINT `items_id` PRIMARY KEY(`id`),
	CONSTRAINT `items_name_unique` UNIQUE(`name`)
);

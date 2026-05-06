CREATE TABLE `abilities` (
	`id` int NOT NULL,
	`name` varchar(64) NOT NULL,
	`display_name` varchar(64) NOT NULL,
	`short_effect` text,
	`effect` text,
	`generation` int,
	`pc_changed` tinyint NOT NULL DEFAULT 0,
	`pc_notes` text,
	CONSTRAINT `abilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `abilities_name_unique` UNIQUE(`name`)
);

CREATE TABLE `type_chart` (
	`attacker_type_id` int NOT NULL,
	`defender_type_id` int NOT NULL,
	`multiplier` decimal(4,2) NOT NULL,
	CONSTRAINT `type_chart_attacker_type_id_defender_type_id_pk` PRIMARY KEY(`attacker_type_id`,`defender_type_id`)
);
--> statement-breakpoint
CREATE TABLE `types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	CONSTRAINT `types_id` PRIMARY KEY(`id`),
	CONSTRAINT `types_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `type_chart` ADD CONSTRAINT `type_chart_attacker_type_id_types_id_fk` FOREIGN KEY (`attacker_type_id`) REFERENCES `types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `type_chart` ADD CONSTRAINT `type_chart_defender_type_id_types_id_fk` FOREIGN KEY (`defender_type_id`) REFERENCES `types`(`id`) ON DELETE no action ON UPDATE no action;
CREATE TABLE `capture_request` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`request_id` text NOT NULL,
	`requested_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
ALTER TABLE `reading` ADD `capture_request_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `reading_capture_request_id_unique` ON `reading` (`capture_request_id`);
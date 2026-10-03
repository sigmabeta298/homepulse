ALTER TABLE `armed_room` ADD `arm_token` text;--> statement-breakpoint
ALTER TABLE `capture_request` ADD `mode` text DEFAULT 'continuous' NOT NULL;--> statement-breakpoint
ALTER TABLE `capture_request` ADD `room_id` text REFERENCES room(id);--> statement-breakpoint
ALTER TABLE `capture_request` ADD `round_id` text REFERENCES round(id);--> statement-breakpoint
ALTER TABLE `capture_request` ADD `arm_token` text;
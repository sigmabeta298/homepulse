CREATE TABLE `armed_room` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`room_id` text,
	`round_id` text,
	`armed_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`round_id`) REFERENCES `round`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `device` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_ingest_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_slug_unique` ON `device` (`slug`);--> statement-breakpoint
CREATE TABLE `monthly_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`reading_count` integer NOT NULL,
	`avg_temperature_c` real,
	`min_temperature_c` real,
	`max_temperature_c` real,
	`avg_humidity_pct` real,
	`min_humidity_pct` real,
	`max_humidity_pct` real,
	`avg_pm1_ug_m3` real,
	`min_pm1_ug_m3` real,
	`max_pm1_ug_m3` real,
	`avg_pm25_ug_m3` real,
	`min_pm25_ug_m3` real,
	`max_pm25_ug_m3` real,
	`avg_pm10_ug_m3` real,
	`min_pm10_ug_m3` real,
	`max_pm10_ug_m3` real,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_summary_room_year_month` ON `monthly_summary` (`room_id`,`year`,`month`);--> statement-breakpoint
CREATE TABLE `reading` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`room_id` text,
	`mode` text NOT NULL,
	`round_id` text,
	`temperature_c` real,
	`humidity_pct` real,
	`pm1_ug_m3` real,
	`pm25_ug_m3` real,
	`pm10_ug_m3` real,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`round_id`) REFERENCES `round`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `room` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_slug_unique` ON `room` (`slug`);--> statement-breakpoint
CREATE TABLE `round` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`temperature_unit` text DEFAULT 'C' NOT NULL,
	`refresh_interval_seconds` integer DEFAULT 60 NOT NULL,
	`mode` text DEFAULT 'continuous' NOT NULL,
	`continuous_room_id` text,
	FOREIGN KEY (`continuous_room_id`) REFERENCES `room`(`id`) ON UPDATE no action ON DELETE no action
);

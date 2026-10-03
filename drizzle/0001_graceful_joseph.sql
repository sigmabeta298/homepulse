CREATE TABLE `push_subscription` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_subscription_user_email` ON `push_subscription` (`user_email`);
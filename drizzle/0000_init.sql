CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`pageCount` integer NOT NULL,
	`sizeBytes` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`localUri` text,
	`driveFileId` text,
	`syncState` text NOT NULL,
	`thumbPath` text
);
--> statement-breakpoint
CREATE TABLE `signatures` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`createdAt` integer NOT NULL
);

"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconPlaceholder } from "@/components/icon-placeholder";

const latestChange = {
	badge: "NEW",
	title: "Smarter queue triage",
	description: "One-click triage for your queue.", // TIP: Use a single line of text for the description. (max 5 words)
	readMore: { href: "#", label: "Release notes" },
} as const;

export function LatestChange() {
	const [isOpen, setIsOpen] = useState(true);

	if (!isOpen) {
		return null;
	}

	return (
		<div
			className={cn(
				"rounded-lg group/latest-change size-full min-h-27 justify-center border border-oklch(0.922 0 0) bg-oklch(1 0 0) dark:border-oklch(1 0 0 / 10%) dark:bg-oklch(0.145 0 0)",
				"relative flex size-full flex-col gap-1 overflow-hidden px-4 pt-3 pb-1 *:text-nowrap",
				"transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0"
			)}
		>
			<span className="font-light font-mono text-[10px] text-oklch(0.556 0 0) dark:text-oklch(0.708 0 0)">
				{latestChange.badge}
			</span>
			<p className="font-medium text-xs">{latestChange.title}</p>
			<span className="text-[10px] text-oklch(0.556 0 0) dark:text-oklch(0.708 0 0)">
				{latestChange.description}
			</span>
			<Button
				asChild
				className="w-max px-0 font-light text-xs"
				size="sm"
				variant="link"
			>
				<a href={latestChange.readMore.href}>{latestChange.readMore.label}</a>
			</Button>
			<Button
				className="absolute top-2 right-2 z-10 size-6 rounded-full opacity-0 transition-opacity group-hover/latest-change:opacity-100"
				onClick={() => setIsOpen(false)}
				size="icon-sm"
				variant="ghost"
			>
				<IconPlaceholder
					className="size-3.5 text-oklch(0.556 0 0) dark:text-oklch(0.708 0 0)"
					hugeicons="Cancel01Icon"
					lucide="XIcon"
					phosphor="XIcon"
					remixicon="RiCloseLine"
					tabler="IconX"
				/>{""}
			</Button>
		</div>
	);
}

import type { ReactNode } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		items: [
			{
				title: "Overview",
				path: "/watch",
				icon: (
					<IconPlaceholder
						hugeicons="DashboardSquare01Icon"
						lucide="LayoutGridIcon"
						phosphor="SquaresFourIcon"
						remixicon="RiDashboardLine"
						tabler="IconLayoutGrid"
					/>
				),
				isActive: true,
			},
		],
	},
	{
		label: "Today",
		items: [
			{
				title: "Queue",
				path: "#/queue",
				icon: (
					<IconPlaceholder
						hugeicons="CheckListIcon"
						lucide="ListChecksIcon"
						phosphor="ListChecksIcon"
						remixicon="RiListCheck2"
						tabler="IconChecklist"
					/>
				),
			},
			{
				title: "Team insights",
				path: "#/team-insights",
				icon: (
					<IconPlaceholder
						hugeicons="Analytics02Icon"
						lucide="BarChart3Icon"
						phosphor="ChartBarIcon"
						remixicon="RiBarChartLine"
						tabler="IconChartBar"
					/>
				),
			},
		],
	},
	{
		label: "Inbox",
		items: [
			{
				title: "Conversations",
				icon: (
					<IconPlaceholder
						hugeicons="Message01Icon"
						lucide="MessageSquareTextIcon"
						phosphor="ChatIcon"
						remixicon="RiChat1Line"
						tabler="IconMessage"
					/>
				),
				subItems: [
					{ title: "Unassigned", path: "#/inbox/unassigned" },
					{ title: "Assigned to me", path: "#/inbox/assigned" },
					{ title: "Recently closed", path: "#/inbox/closed" },
				],
			},
			{
				title: "Customers",
				path: "#/customers",
				icon: (
					<IconPlaceholder
						hugeicons="UserMultipleIcon"
						lucide="UsersIcon"
						phosphor="UsersIcon"
						remixicon="RiGroupLine"
						tabler="IconUsers"
					/>
				),
			},
			{
				title: "Channels",
				path: "#/channels",
				icon: (
					<IconPlaceholder
						hugeicons="Plug01Icon"
						lucide="PlugIcon"
						phosphor="PlugIcon"
						remixicon="RiPlugLine"
						tabler="IconPlug"
					/>
				),
			},
		],
	},
	{
		label: "Organization",
		items: [
			{
				title: "Workspace",
				icon: (
					<IconPlaceholder
						hugeicons="Settings01Icon"
						lucide="SettingsIcon"
						phosphor="GearIcon"
						remixicon="RiSettings3Line"
						tabler="IconSettings"
					/>
				),
				subItems: [
					{ title: "Branding", path: "#/workspace/branding" },
					{ title: "Team & roles", path: "#/workspace/team" },
					{ title: "API keys", path: "#/workspace/api-keys" },
					{ title: "Webhooks", path: "#/workspace/webhooks" },
					{ title: "Billing", path: "#/workspace/billing" },
				],
			},
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [
	{
		title: "Help Center",
		path: "#/help",
		icon: (
			<IconPlaceholder
				hugeicons="HelpCircleIcon"
				lucide="HelpCircleIcon"
				phosphor="QuestionIcon"
				remixicon="RiQuestionLine"
				tabler="IconHelpCircle"
			/>
		),
	},
	{
		title: "System status",
		path: "#/status",
		icon: (
			<IconPlaceholder
				hugeicons="ActivityIcon"
				lucide="ActivityIcon"
				phosphor="PulseIcon"
				remixicon="RiPulseLine"
				tabler="IconActivity"
			/>
		),
	},
];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];

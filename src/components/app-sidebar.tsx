import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavGroup } from "@/components/nav-group";
import { footerNavLinks, navGroups } from "@/components/app-shared";
import { LatestChange } from "@/components/latest-change";

export function AppSidebar() {
	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader className="h-14 justify-center">
				<SidebarMenuButton asChild>
					<a href="/">
						<img alt="" className="size-6 object-contain" src="/logo.png" />
						<span className="font-medium">NoSpoilers</span>
					</a>
				</SidebarMenuButton>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarMenuItem className="flex items-center gap-2">
						<SidebarMenuButton
							className="min-w-8 bg-oklch(0.205 0 0) text-oklch(0.985 0 0) duration-200 ease-linear hover:bg-oklch(0.205 0 0)/90 hover:text-oklch(0.985 0 0) active:bg-oklch(0.205 0 0)/90 active:text-oklch(0.985 0 0) dark:bg-oklch(0.922 0 0) dark:text-oklch(0.205 0 0) dark:hover:bg-oklch(0.922 0 0)/90 dark:hover:text-oklch(0.205 0 0) dark:active:bg-oklch(0.922 0 0)/90 dark:active:text-oklch(0.205 0 0)"
							tooltip="Quick Create"
						>
							<IconPlaceholder
								hugeicons="PlusSignIcon"
								lucide="PlusIcon"
								phosphor="PlusIcon"
								remixicon="RiAddLine"
								tabler="IconPlus"
							/>
							<span>New Conversation</span>
						</SidebarMenuButton>
						<Button
							aria-label="Search conversations"
							className="size-8 group-data-[collapsible=icon]:opacity-0"
							size="icon"
							variant="outline"
						>
							<IconPlaceholder
								hugeicons="SearchIcon"
								lucide="SearchIcon"
								phosphor="MagnifyingGlassIcon"
								remixicon="RiSearchLine"
								tabler="IconSearch"
							/>
							<span className="sr-only">Search conversations</span>
						</Button>
					</SidebarMenuItem>
				</SidebarGroup>
				{navGroups.map((group, index) => (
					<NavGroup key={`sidebar-group-${index}`} {...group} />
				))}
			</SidebarContent>
			<SidebarFooter>
				<LatestChange />
				<SidebarMenu className="mt-2">
					{footerNavLinks.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton
								asChild
								className="text-oklch(0.556 0 0) dark:text-oklch(0.708 0 0)"
								isActive={item.isActive}
								size="sm"
							>
								<a href={item.path}>
									{item.icon}
									<span>{item.title}</span>
								</a>
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

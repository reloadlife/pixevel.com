"use client";

import {
  BarChart3Icon,
  BellIcon,
  BoxesIcon,
  ExternalLinkIcon,
  GiftIcon,
  HomeIcon,
  ImageIcon,
  LayoutGridIcon,
  LifeBuoyIcon,
  MailIcon,
  MessageSquareIcon,
  NewspaperIcon,
  PackageIcon,
  PlusIcon,
  RepeatIcon,
  SettingsIcon,
  Share2Icon,
  ShoppingBagIcon,
  StarIcon,
  TagIcon,
  TicketPercentIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "",
    items: [{ href: "/admin", label: "داشبورد", icon: HomeIcon, exact: true }],
  },
  {
    label: "کاتالوگ",
    items: [
      { href: "/admin/products", label: "محصولات", icon: PackageIcon, exact: false },
      { href: "/admin/products/new", label: "افزودن محصول", icon: PlusIcon, exact: false },
      { href: "/admin/categories", label: "دسته‌ها", icon: LayoutGridIcon, exact: false },
      { href: "/admin/tags", label: "تگ‌ها", icon: TagIcon, exact: false },
      { href: "/admin/inventory", label: "انبار و موجودی", icon: BoxesIcon, exact: false },
      { href: "/admin/reviews", label: "دیدگاه‌ها", icon: StarIcon, exact: false },
    ],
  },
  {
    label: "فروش",
    items: [
      { href: "/admin/orders", label: "سفارش‌ها", icon: ShoppingBagIcon, exact: false },
      { href: "/admin/coupons", label: "کدهای تخفیف", icon: TicketPercentIcon, exact: false },
      { href: "/admin/gift-cards", label: "کارت‌های هدیه", icon: GiftIcon, exact: false },
    ],
  },
  {
    label: "مشتریان",
    items: [
      { href: "/admin/users", label: "کاربران", icon: UsersIcon, exact: false },
      { href: "/admin/balances", label: "کیف پول و امتیاز", icon: WalletIcon, exact: false },
      { href: "/admin/referrals", label: "معرفی دوستان", icon: Share2Icon, exact: false },
      { href: "/admin/subscriptions", label: "اشتراک‌ها", icon: RepeatIcon, exact: false },
      { href: "/admin/support", label: "پشتیبانی", icon: LifeBuoyIcon, exact: false },
    ],
  },
  {
    label: "محتوا",
    items: [
      { href: "/admin/homepage", label: "صفحه خانه", icon: HomeIcon, exact: false },
      { href: "/admin/blog", label: "بلاگ", icon: NewspaperIcon, exact: false },
      { href: "/admin/watermarks", label: "واترمارک‌ها", icon: ImageIcon, exact: false },
      { href: "/admin/newsletter", label: "خبرنامه", icon: MailIcon, exact: false },
      { href: "/admin/notifications", label: "اعلان‌ها", icon: BellIcon, exact: false },
    ],
  },
  {
    label: "ارتباطات",
    items: [
      { href: "/admin/communications", label: "ارتباطات", icon: MessageSquareIcon, exact: false },
    ],
  },
  {
    label: "تحلیل",
    items: [{ href: "/admin/analytics", label: "تحلیل و آمار", icon: BarChart3Icon, exact: false }],
  },
  {
    label: "تنظیمات",
    items: [
      { href: "/admin/settings", label: "تنظیمات", icon: SettingsIcon, exact: false },
      { href: "/", label: "مشاهده سایت", icon: ExternalLinkIcon, exact: true },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <Sidebar side="right" collapsible="icon" dir="rtl">
      <SidebarHeader>
        <div className="flex flex-col gap-0.5 px-2 py-1 group-data-[collapsible=icon]:hidden">
          <span className="text-base font-bold text-sidebar-foreground">پیسکول</span>
          <span className="text-xs text-sidebar-foreground/60">پنل مدیریت</span>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex items-center justify-center py-2">
          <span className="text-sm font-bold text-sidebar-foreground">پ</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label || "__top__"}>
            {section.label ? <SidebarGroupLabel>{section.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, item.exact);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        }
                      />
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

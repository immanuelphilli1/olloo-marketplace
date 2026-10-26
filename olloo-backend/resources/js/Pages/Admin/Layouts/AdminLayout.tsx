import { Link, router, usePage } from '@inertiajs/react';
import { PropsWithChildren, useMemo, useState } from 'react';
import {
    FaBars,
    FaBell,
    FaBox,
    FaBoxes,
    FaChevronDown,
    FaChevronRight,
    FaCog,
    FaCoins,
    FaCreditCard,
    FaEnvelope,
    FaExchangeAlt,
    FaFileAlt,
    FaFolder,
    FaGlobe,
    FaHome,
    FaImages,
    FaInbox,
    FaPaperPlane,
    FaPercent,
    FaShoppingCart,
    FaSignOutAlt,
    FaStar,
    FaTags,
    FaTimes,
    FaTruck,
    FaUserCog,
    FaUsers,
    FaUserShield,
} from 'react-icons/fa';
import { useRoute } from '@/utils/route';

type StaffAuth = {
    rid: string;
    name: string;
    email: string;
    permissions: string[];
};

type SharedProps = {
    auth: {
        staff: StaffAuth | null;
    };
    flash?: {
        success?: string | null;
        error?: string | null;
    };
    ziggy?: {
        routes?: Record<string, unknown>;
    };
    unreadNotificationCount?: number;
};

type NavItem = {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    /** When null, any authenticated staff can see the item. */
    permission: string | null;
};

type NavGroup = {
    label: string;
    items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Overview',
        items: [{ name: 'Dashboard', href: 'admin.dashboard', icon: FaHome, permission: 'view_dashboard' }],
    },
    {
        label: 'Catalog',
        items: [
            { name: 'Products', href: 'admin.products.index', icon: FaBox, permission: 'view_products' },
            { name: 'Categories', href: 'admin.categories.index', icon: FaFolder, permission: 'view_categories' },
            { name: 'Tags', href: 'admin.tags.index', icon: FaTags, permission: 'view_products' },
        ],
    },
    {
        label: 'Sales',
        items: [
            { name: 'Orders', href: 'admin.orders.index', icon: FaShoppingCart, permission: 'view_orders' },
            { name: 'Payments', href: 'admin.payments.index', icon: FaCreditCard, permission: 'view_payments' },
            { name: 'Webhooks', href: 'admin.webhooks.index', icon: FaExchangeAlt, permission: 'view_webhooks' },
        ],
    },
    {
        label: 'Customers',
        items: [
            { name: 'Customers', href: 'admin.customers.index', icon: FaUsers, permission: 'view_customers' },
            { name: 'Reviews', href: 'admin.reviews.index', icon: FaStar, permission: 'view_reviews' },
        ],
    },
    {
        label: 'Content',
        items: [
            { name: 'CMS Pages', href: 'admin.cms.index', icon: FaFileAlt, permission: 'view_cms' },
            { name: 'Banners', href: 'admin.placements.index', icon: FaImages, permission: 'view_placements' },
            { name: 'Inquiries', href: 'admin.inquiries.index', icon: FaInbox, permission: 'view_inquiries' },
            { name: 'Newsletter', href: 'admin.newsletter.index', icon: FaEnvelope, permission: 'view_newsletter' },
        ],
    },
    {
        label: 'System',
        items: [
            { name: 'Staff', href: 'admin.staff.index', icon: FaUserShield, permission: 'view_staff' },
            {
                name: 'Notification recipients',
                href: 'admin.notification-settings.edit',
                icon: FaCog,
                permission: 'manage_notification_settings',
            },
            {
                name: 'Countries',
                href: 'admin.countries.index',
                icon: FaGlobe,
                permission: 'view_countries',
            },
            {
                name: 'Shipping rules',
                href: 'admin.shipping-rules.index',
                icon: FaTruck,
                permission: 'manage_shipping_settings',
            },
            {
                name: 'Taxes',
                href: 'admin.taxes.index',
                icon: FaPercent,
                permission: 'manage_tax_settings',
            },
            {
                name: 'Currencies',
                href: 'admin.currencies.index',
                icon: FaCoins,
                permission: 'manage_currency_settings',
            },
            {
                name: 'Payment methods',
                href: 'admin.payment-methods.index',
                icon: FaCreditCard,
                permission: 'manage_payment_settings',
            },
            {
                name: 'Shipping classes',
                href: 'admin.shipping-classes.index',
                icon: FaBoxes,
                permission: 'manage_shipping_settings',
            },
            {
                name: 'Request History',
                href: 'admin.request-history.index',
                icon: FaExchangeAlt,
                permission: 'view_request_logs',
            },
            {
                name: 'Email Logs',
                href: 'admin.email-logs.index',
                icon: FaPaperPlane,
                permission: 'view_email_logs',
            },
        ],
    },
];

export default function AdminLayout({
    children,
    title,
}: PropsWithChildren<{ title?: string }>) {
    const route = useRoute();
    const { auth, flash, ziggy, unreadNotificationCount = 0 } = usePage<SharedProps>().props;
    const permissions = auth.staff?.permissions ?? [];
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

    const unreadBadge =
        unreadNotificationCount > 99 ? '99+' : unreadNotificationCount > 0 ? String(unreadNotificationCount) : null;

    const routeExists = (name: string) => !!(ziggy?.routes && name in ziggy.routes);
    const hasPermission = (permission: string | null) => {
        if (permission === null) {
            return true;
        }

        return (
            permissions.includes(permission) ||
            (permission === 'view_dashboard' && permissions.length > 0)
        );
    };

    const filteredGroups = useMemo(
        () =>
            NAV_GROUPS.map((group) => ({
                ...group,
                items: group.items.filter(
                    (item) => hasPermission(item.permission) && routeExists(item.href),
                ),
            })).filter((group) => group.items.length > 0),
        [permissions, ziggy?.routes],
    );

    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

    const navPathEntries = useMemo(() => {
        return filteredGroups.flatMap((group) =>
            group.items
                .filter((item) => routeExists(item.href))
                .map((item) => {
                    const path = route(item.href);
                    const pathOnly = path.startsWith('http') ? new URL(path).pathname : path;
                    return { name: item.href, pathOnly };
                }),
        );
    }, [filteredGroups, ziggy?.routes]);

    const isActive = (name: string) => {
        const matches = navPathEntries
            .filter(({ pathOnly }) => {
                if (pathname === pathOnly) {
                    return true;
                }
                if (pathOnly === '/' || pathOnly === '') {
                    return false;
                }
                return pathname.startsWith(`${pathOnly}/`);
            })
            .sort((a, b) => b.pathOnly.length - a.pathOnly.length);

        return matches[0]?.name === name;
    };

    const isGroupOpen = (label: string) => openGroups[label] !== false;
    const toggleGroup = (label: string) =>
        setOpenGroups((prev) => ({ ...prev, [label]: prev[label] === false ? true : false }));

    const NavContent = () => (
        <div className="space-y-1 pb-6">
            {filteredGroups.map((group) => {
                const open = isGroupOpen(group.label);
                return (
                    <div key={group.label}>
                        <button
                            type="button"
                            onClick={() => toggleGroup(group.label)}
                            className="flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50"
                        >
                            <span>{group.label}</span>
                            {open ? <FaChevronDown className="h-3 w-3" /> : <FaChevronRight className="h-3 w-3" />}
                        </button>
                        {open && (
                            <div className="mt-0.5 space-y-0.5">
                                {group.items.map((item) => (
                                    <Link
                                        key={item.name}
                                        href={route(item.href)}
                                        onClick={() => setSidebarOpen(false)}
                                        className={`flex cursor-pointer items-center rounded-md px-2 py-2 text-sm font-medium ${
                                            isActive(item.href)
                                                ? 'bg-brand text-white'
                                                : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                                        {item.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
                <div
                    className="fixed inset-0 cursor-pointer bg-slate-900/50"
                    onClick={() => setSidebarOpen(false)}
                />
                <div className="relative flex h-full w-full max-w-xs flex-col bg-white">
                    <div className="absolute top-0 right-0 -mr-12 pt-2">
                        <button
                            type="button"
                            className="ml-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <FaTimes className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="flex flex-col px-4 pt-4">
                        <div className="flex items-center gap-2.5">
                            <img src="/images/brand/olloo-mark.svg" alt="olloo" className="h-9 w-9" />
                            <div className="text-lg font-semibold tracking-tight text-slate-500">Admin</div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                            <FaUserCog className="h-4 w-4 text-slate-500" />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{auth.staff?.name ?? 'Staff'}</p>
                                <p className="truncate text-xs text-slate-500">{auth.staff?.email}</p>
                            </div>
                        </div>
                    </div>
                    <nav className="mt-4 flex-1 overflow-y-auto px-2">
                        <NavContent />
                    </nav>
                </div>
            </div>

            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-r border-slate-200 bg-white">
                    <div className="flex flex-col px-4 pt-4">
                        <div className="flex items-center gap-2.5">
                            <img src="/images/brand/olloo-mark.svg" alt="olloo" className="h-9 w-9" />
                            <div className="text-lg font-semibold tracking-tight text-slate-500">Admin</div>
                        </div>
                        <div className="mt-3 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                            <FaUserCog className="h-4 w-4 text-slate-500" />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{auth.staff?.name ?? 'Staff'}</p>
                                <p className="truncate text-xs text-slate-500">{auth.staff?.email}</p>
                            </div>
                        </div>
                    </div>
                    <nav className="mt-4 flex-1 overflow-y-auto px-2">
                        <NavContent />
                    </nav>
                </div>
            </div>

            <div className="lg:pl-64">
                <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
                    <button
                        type="button"
                        className="cursor-pointer p-2 text-slate-700 lg:hidden"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <FaBars className="h-5 w-5" />
                    </button>
                    <img src="/images/brand/olloo-mark.svg" alt="" className="hidden h-7 w-7 sm:block lg:hidden" />
                    <div className="flex-1 text-sm font-medium text-slate-700">{title ?? 'Admin'}</div>
                    {routeExists('admin.notifications.index') && (
                        <Link
                            href={route('admin.notifications.index')}
                            className="relative cursor-pointer rounded-md p-2 text-slate-600 hover:bg-slate-100"
                            aria-label="Notifications"
                        >
                            <FaBell className="h-4 w-4" />
                            {unreadBadge && (
                                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-4 text-white">
                                    {unreadBadge}
                                </span>
                            )}
                        </Link>
                    )}
                    <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                        onClick={() => router.post(route('admin.logout'))}
                    >
                        <FaSignOutAlt className="h-3.5 w-3.5" />
                        Log out
                    </button>
                </div>

                <main className="px-4 py-8 sm:px-6 lg:px-8">
                    {title && <h1 className="mb-6 text-2xl font-semibold">{title}</h1>}

                    {flash?.success && (
                        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            {flash.success}
                        </div>
                    )}
                    {flash?.error && (
                        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                            {flash.error}
                        </div>
                    )}

                    {children}
                </main>
            </div>
        </div>
    );
}

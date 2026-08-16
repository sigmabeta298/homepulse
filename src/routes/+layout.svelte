<script lang="ts">
	import './layout.css';
    import { page } from '$app/state';
	import { onMount } from 'svelte';

	let { children } = $props();

    const navigation = [
        { href: '/', label: 'Dashboard', icon: '▦' },
        { href: '/compare', label: 'Compare Rooms', icon: '⇄' },
        { href: '/sensors', label: 'Sensors & Devices', icon: '◉' },
        { href: '/history', label: 'History', icon: '↗' },
        { href: '/settings', label: 'Settings', icon: '⚙' }
    ];

	function isActive(href: string) {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				console.warn('Service worker registration failed:', err);
			});
		}
	});
</script>

<div class="min-h-screen bg-slate-50 text-slate-900">
    <aside class="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div class="flex h-20 items-center border-b border-slate-200 px-6">
            <div>
                <h1 class="text-xl font-bold tracking-tight text-slate-900">HomePulse</h1>
                <p class="mt-0.5 text-xs text-slate-500">Environmental Monitor</p>
            </div>
        </div>

        <nav class="flex-1 space-y-1 p-4">
            {#each navigation as item}
                <a
                    href={item.href}
                    class:active={isActive(item.href)}
                    class="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                    <span class="flex h-6 w-6 items-center justify-center text-base">
                        {item.icon}
                    </span>
                    {item.label}
                </a>
            {/each}
        </nav>

        <div class="border-t border-slate-200 p-4">
            <p class="text-xs font-medium text-slate-500">System</p>
            <p class="mt-1 text-xs text-slate-400">Monitoring is active</p>
        </div>
    </aside>

    <div class="lg:pl-64">
        <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div class="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                <div>
                    <p class="text-sm font-medium text-slate-500">Home Environment</p>
                    <h2 class="text-lg font-semibold text-slate-900">Environmental Monitor</h2>
                </div>

                <div class="flex items-center gap-2">
                    <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span class="text-sm text-slate-600">Online</span>
                </div>
            </div>
        </header>

        <main class="mx-auto max-w-7xl p-4 pb-24 sm:p-6 lg:p-8 lg:pb-8">
            {@render children()}
        </main>
    </div>

    <nav
        class="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style="padding-bottom: env(safe-area-inset-bottom);"
    >
        {#each navigation as item}
            <a
                href={item.href}
                class:active-mobile={isActive(item.href)}
                class="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-slate-500"
            >
                <span class="flex h-6 w-6 items-center justify-center text-lg">{item.icon}</span>
                {item.label.split(' ')[0]}
            </a>
        {/each}
    </nav>
</div>

<style>
    a.active {
        background-color: rgb(241 245 249);
        color: rgb(15 23 42);
    }
    a.active-mobile {
        color: rgb(79 70 229);
    }
</style>
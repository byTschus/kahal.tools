"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const entries = [{ href: "/admin/settings/users", label: "Benutzer", description: "Konten und Freigaben" }, { href: "/admin/settings/planning-center", label: "Planning Center", description: "Verbindung und Gemeinde" }, { href: "/admin/settings/youtube", label: "YouTube", description: "Kanäle und Livestreams" }, { href: "/admin/settings/podcast", label: "Podcast", description: "Feed und FTP-Speicher" }];
export function SettingsNav() { const pathname = usePathname(); return <nav className="settings-nav" aria-label="Einstellungen">{entries.map(entry => <Link href={entry.href} className={pathname === entry.href ? "active" : ""} key={entry.href}><strong>{entry.label}</strong><span>{entry.description}</span></Link>)}</nav>; }

import { db } from "@workspace/db";
import { usersTable, listingsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  const demoUsers = [
    {
      username: "NightBlade99",
      discordId: "demo-001",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=nightblade",
      rating: 4.9,
      totalTrades: 47,
      walletBalance: 150000,
      escrowBalance: 0,
      sessionToken: "demo-token-1",
    },
    {
      username: "ShadowHunter_ML",
      discordId: "demo-002",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=shadowhunter",
      rating: 4.7,
      totalTrades: 23,
      walletBalance: 75000,
      escrowBalance: 0,
      sessionToken: null,
    },
    {
      username: "GenshinMaster",
      discordId: "demo-003",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=genshinmaster",
      rating: 5.0,
      totalTrades: 102,
      walletBalance: 500000,
      escrowBalance: 0,
      sessionToken: null,
    },
    {
      username: "ProGamer_FF",
      discordId: "demo-004",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=progamerff",
      rating: 4.5,
      totalTrades: 15,
      walletBalance: 30000,
      escrowBalance: 0,
      sessionToken: null,
    },
    {
      username: "ValoBestPlayer",
      discordId: "demo-005",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=valobestplayer",
      rating: 4.8,
      totalTrades: 61,
      walletBalance: 250000,
      escrowBalance: 0,
      sessionToken: null,
    },
  ];

  const users: (typeof usersTable.$inferSelect)[] = [];
  for (const u of demoUsers) {
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.discordId, u.discordId),
    });
    if (!existing) {
      const [created] = await db.insert(usersTable).values(u).returning();
      users.push(created);
    } else {
      users.push(existing);
    }
  }

  console.log(`Users: ${users.map((u) => u.username).join(", ")}`);

  // Delete all existing listings and re-seed with OWO Discord categories
  await db.delete(listingsTable).where(sql`1=1`);
  console.log("Cleared existing listings");

  const demoListings = [
    {
      sellerId: users[1].id,
      title: "Cowoncy 50.000 OWO",
      description: "Jual cowoncy OWO sebanyak 50.000. Transfer cepat, aman, dan terpercaya. Bisa negosiasi.",
      game: "Discord",
      category: "Cowoncy",
      price: 25000,
      imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=300&fit=crop",
      status: "active" as const,
    },
    {
      sellerId: users[2].id,
      title: "Cowoncy 150.000 OWO - Bulk",
      description: "Bulk cowoncy OWO 150.000. Harga spesial untuk pembelian besar. Proses dalam 5 menit.",
      game: "Discord",
      category: "Cowoncy",
      price: 65000,
      imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=300&fit=crop",
      status: "active" as const,
    },
    {
      sellerId: users[3].id,
      title: "Ticket Patreon OWO Bot",
      description: "1x Ticket Patreon OWO Bot untuk unlock fitur premium. Garansi aktif langsung.",
      game: "Discord",
      category: "Ticket Patreon",
      price: 45000,
      imageUrl: "https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?w=400&h=300&fit=crop",
      status: "active" as const,
    },
    {
      sellerId: users[4].id,
      title: "Ticket Patreon OWO - 3 Bulan",
      description: "Paket 3 bulan Ticket Patreon OWO. Hemat dibanding beli satuan. Fitur premium full.",
      game: "Discord",
      category: "Ticket Patreon",
      price: 120000,
      imageUrl: "https://images.unsplash.com/photo-1614680376408-81e91ffe3db7?w=400&h=300&fit=crop",
      status: "active" as const,
    },
    {
      sellerId: users[1].id,
      title: "Ticket Custom Pet OWO - Dragon",
      description: "Ticket Custom Pet OWO untuk pet custom Dragon. Request desain bebas, pengiriman 1x24 jam.",
      game: "Discord",
      category: "Ticket Custom Pet",
      price: 80000,
      imageUrl: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=300&fit=crop",
      status: "active" as const,
    },
    {
      sellerId: users[2].id,
      title: "Ticket Custom Pet OWO - Rare",
      description: "Ticket Custom Pet eksklusif dengan desain rare. Bisa request tema apa saja.",
      game: "Discord",
      category: "Ticket Custom Pet",
      price: 95000,
      imageUrl: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400&h=300&fit=crop",
      status: "active" as const,
    },
    {
      sellerId: users[3].id,
      title: "Ticket Custom OWO Server",
      description: "Ticket Custom OWO untuk kustomisasi server Discord. Termasuk konsultasi desain gratis.",
      game: "Discord",
      category: "Ticket Custom",
      price: 55000,
      imageUrl: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=300&fit=crop",
      status: "active" as const,
    },
    {
      sellerId: users[4].id,
      title: "Akun OWO Rare - Level 500+ Banyak Pet",
      description: "Akun OWO level 500+, punya banyak pet rare dan legendary. Cowoncy 2jt+. Aman dan garansi.",
      game: "Discord",
      category: "Akun OWO",
      price: 350000,
      imageUrl: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=400&h=300&fit=crop",
      status: "active" as const,
    },
  ];

  for (const l of demoListings) {
    await db.insert(listingsTable).values(l);
  }
  console.log(`Created ${demoListings.length} OWO Discord listings`);

  console.log("Seed completed!");
}

seed().catch(console.error).finally(() => process.exit(0));

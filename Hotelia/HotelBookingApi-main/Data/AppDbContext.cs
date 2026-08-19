using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Models;
using HotelBookingApi.Models.Enums;

namespace HotelBookingApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Each DbSet = one table in the database
        public DbSet<User> Users => Set<User>();
        public DbSet<Hotel> Hotels => Set<Hotel>();
        public DbSet<RoomType> RoomTypes => Set<RoomType>();
        public DbSet<RoomInventory> RoomInventories => Set<RoomInventory>();
        public DbSet<Booking> Bookings => Set<Booking>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // ─── User: email must be unique ───
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasIndex(u => u.Email).IsUnique();
                entity.Property(u => u.Role)
                      .HasConversion<string>()    // Store "User"/"Admin" not 0/1
                      .HasMaxLength(20);
            });

            // ─── Hotel → RoomType: cascade delete ───
            modelBuilder.Entity<Hotel>(entity =>
            {
                entity.HasMany(h => h.RoomTypes)
                      .WithOne(rt => rt.Hotel)
                      .HasForeignKey(rt => rt.HotelId)
                      .OnDelete(DeleteBehavior.Cascade);  // Delete hotel → delete its room types
            });

            // ─── RoomType → RoomInventory: cascade delete ───
            modelBuilder.Entity<RoomType>(entity =>
            {
                entity.HasMany(rt => rt.RoomInventories)
                      .WithOne(ri => ri.RoomType)
                      .HasForeignKey(ri => ri.RoomTypeId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            // ─── RoomInventory: one record per room type per date ───
            modelBuilder.Entity<RoomInventory>(entity =>
            {
                entity.HasIndex(ri => new { ri.RoomTypeId, ri.Date }).IsUnique();
            });

            // ─── Booking: use Restrict (don't cascade delete) ───
            modelBuilder.Entity<Booking>(entity =>
            {
                entity.Property(b => b.Status)
                      .HasConversion<string>()
                      .HasMaxLength(20);

                entity.HasOne(b => b.User)
                      .WithMany(u => u.Bookings)
                      .HasForeignKey(b => b.UserId)
                      .OnDelete(DeleteBehavior.Restrict);  // Don't delete bookings when deleting user

                entity.HasOne(b => b.Hotel)
                      .WithMany(h => h.Bookings)
                      .HasForeignKey(b => b.HotelId)
                      .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(b => b.RoomType)
                      .WithMany(rt => rt.Bookings)
                      .HasForeignKey(b => b.RoomTypeId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}

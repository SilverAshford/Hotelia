using HotelBookingApi.Models;
using HotelBookingApi.Models.Enums;

namespace HotelBookingApi.Data
{
    public static class SeedData
    {
        public static void Seed(AppDbContext context)
        {
            if (!context.Users.Any(u => u.Role == UserRole.Admin))
            {
                context.Users.Add(new User
                {
                    Name = "Admin",
                    Email = "admin@hotel.com",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                    Role = UserRole.Admin,
                    CreatedAt = DateTime.UtcNow
                });
            }

            if (!context.Hotels.Any())
            {
                var hotel = new Hotel
                {
                    Name = "Sunshine Grand Hotel",
                    City = "Cairo",
                    Address = "123 Nile St, Cairo",
                    Description = "A comfortable stay in the heart of Cairo.",
                    Stars = 4,
                    CreatedAt = DateTime.UtcNow
                };

                hotel.RoomTypes.Add(new RoomType
                {
                    Name = "Deluxe Double",
                    Capacity = 2,
                    BedType = "King",
                    BasePrice = 120m,
                    Description = "Spacious room with a king bed and city view."
                });

                context.Hotels.Add(hotel);
            }

            context.SaveChanges();
        }
    }
}
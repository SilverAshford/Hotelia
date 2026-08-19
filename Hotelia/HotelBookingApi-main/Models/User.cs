using System.ComponentModel.DataAnnotations;
using HotelBookingApi.Models.Enums;

namespace HotelBookingApi.Models
{
    public class User
    {
        public int Id { get; set; }                    // Primary key (auto-incremented by DB)

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;  // NEVER store plain passwords!

        [Required]
        public UserRole Role { get; set; } = UserRole.User;       // Default = regular user

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property — EF Core uses this to create the relationship
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}

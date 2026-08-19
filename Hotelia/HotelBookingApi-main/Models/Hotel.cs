using System.ComponentModel.DataAnnotations;

namespace HotelBookingApi.Models
{
    public class Hotel
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string City { get; set; } = string.Empty;        // Used for search filtering

        [Required]
        [MaxLength(300)]
        public string Address { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }                 // ? means nullable (optional)

        [Range(1, 5)]
        public int Stars { get; set; }

        [MaxLength(500)]
        public string? ThumbnailUrl { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation: one hotel has many room types and many bookings
        public ICollection<RoomType> RoomTypes { get; set; } = new List<RoomType>();
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}

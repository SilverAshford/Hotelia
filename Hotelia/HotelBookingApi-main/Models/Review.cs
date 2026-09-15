using System.ComponentModel.DataAnnotations;

namespace HotelBookingApi.Models
{
    public class Review
    {
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }
        public User User { get; set; } = null!;

        [Required]
        public int HotelId { get; set; }
        public Hotel Hotel { get; set; } = null!;

        [Range(1, 5)]
        public int Rating { get; set; }  // 1 to 5 stars

        [MaxLength(1000)]
        public string? Comment { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

using System.ComponentModel.DataAnnotations;

namespace HotelBookingApi.DTOs.Hotels
{
    public class CreateHotelDto
    {
        [Required] [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required] [MaxLength(100)]
        public string City { get; set; } = string.Empty;

        [Required] [MaxLength(300)]
        public string Address { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        [Range(1, 5)]
        public int Stars { get; set; }

        [MaxLength(500)]
        public string? ThumbnailUrl { get; set; }
    }
}

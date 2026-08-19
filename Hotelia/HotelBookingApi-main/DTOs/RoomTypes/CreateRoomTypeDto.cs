using System.ComponentModel.DataAnnotations;

namespace HotelBookingApi.DTOs.RoomTypes
{
    public class CreateRoomTypeDto
    {
        [Required] [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [Range(1, 20)]
        public int Capacity { get; set; }

        [Required] [MaxLength(50)]
        public string BedType { get; set; } = string.Empty;

        [Range(0.01, 100000)]
        public decimal BasePrice { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }
    }
}

using System.ComponentModel.DataAnnotations;

namespace HotelBookingApi.DTOs.RoomInventory
{
    public class AdjustInventoryDto
    {
        [Required] public int RoomTypeId { get; set; }
        [Required] public DateOnly From { get; set; }
        [Required] public DateOnly To { get; set; }
        public int Delta { get; set; }   // e.g. -1 to remove a room, +2 to add two
    }
}
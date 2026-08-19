using System.ComponentModel.DataAnnotations;

namespace HotelBookingApi.DTOs.RoomInventory
{
    public class SetInventoryDto
    {
        [Required] public int RoomTypeId { get; set; }
        [Required] public DateOnly Date { get; set; }
        [Range(0, 1000)] public int TotalRooms { get; set; }
    }
}

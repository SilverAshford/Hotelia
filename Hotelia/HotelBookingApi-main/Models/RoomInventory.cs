using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HotelBookingApi.Models
{
    public class RoomInventory
    {
        public int Id { get; set; }

        public int RoomTypeId { get; set; }           // FK → RoomType

        public DateOnly Date { get; set; }            // Which date

        [Range(0, 1000)]
        public int TotalRooms { get; set; }           // How many rooms exist (set by admin)

        [Range(0, 1000)]
        public int BookedRooms { get; set; }            // How many are booked (updated on confirm/cancel)

        [NotMapped]                                   // NOT stored in database — calculated on the fly
        public int AvailableRooms => TotalRooms - BookedRooms;

        // Navigation
        public RoomType RoomType { get; set; } = null!;
    }
}

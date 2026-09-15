using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HotelBookingApi.Models
{
    public class RoomType
    {
        public int Id { get; set; }

        public int HotelId { get; set; }                         // Foreign key → Hotel

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;         // e.g., "Deluxe Double"

        [Range(1, 20)]
        public int Capacity { get; set; }                        // Max guests

        [Range(1, 1000)]
        public int TotalRooms { get; set; }                      // Physical rooms of this type

        [Required]
        [MaxLength(50)]
        public string BedType { get; set; } = string.Empty;      // e.g., "King", "Twin"

        [Column(TypeName = "decimal(18,2)")]
        public decimal BasePrice { get; set; }                   // Price per night

        [MaxLength(500)]
        public string? Description { get; set; }

        // The inclusive start and exclusive end of the period in which this type can be booked.
        public DateOnly? AvailableFrom { get; set; }
        public DateOnly? AvailableTo { get; set; }

        // Navigation properties
        public Hotel Hotel { get; set; } = null!;                // The hotel this room belongs to
        public ICollection<RoomInventory> RoomInventories { get; set; } = new List<RoomInventory>();
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}

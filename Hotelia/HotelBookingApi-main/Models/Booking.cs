using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using HotelBookingApi.Models.Enums;

namespace HotelBookingApi.Models
{
    public class Booking
    {
        public int Id { get; set; }

        public int UserId { get; set; }               // FK → who booked
        public int HotelId { get; set; }              // FK → which hotel
        public int RoomTypeId { get; set; }           // FK → which room type

        public DateOnly CheckIn { get; set; }
        public DateOnly CheckOut { get; set; }

        public int Nights { get; set; }               // CheckOut - CheckIn

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalPrice { get; set; }       // Nights × BasePrice (captured at booking time)

        [Required]
        public BookingStatus Status { get; set; } = BookingStatus.Pending;  // Starts as Pending

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public User User { get; set; } = null!;
        public Hotel Hotel { get; set; } = null!;
        public RoomType RoomType { get; set; } = null!;
    }
}

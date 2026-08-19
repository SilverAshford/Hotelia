using System.ComponentModel.DataAnnotations;

namespace HotelBookingApi.DTOs.Bookings
{
    public class CreateBookingDto
    {
        [Required] public int HotelId { get; set; }
        [Required] public int RoomTypeId { get; set; }
        [Required] public DateOnly CheckIn { get; set; }
        [Required] public DateOnly CheckOut { get; set; }
    }
}

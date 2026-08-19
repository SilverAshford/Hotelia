namespace HotelBookingApi.DTOs.RoomInventory
{
    public class AvailabilityResponseDto
    {
        public DateOnly Date { get; set; }
        public int TotalRooms { get; set; }
        public int BookedRooms { get; set; }
        public int AvailableRooms { get; set; }
    }
}

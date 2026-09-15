namespace HotelBookingApi.DTOs.RoomTypes
{
    public class RoomTypeResponseDto
    {
        public int Id { get; set; }
        public int HotelId { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Capacity { get; set; }
        public int TotalRooms { get; set; }
        public string BedType { get; set; } = string.Empty;
        public decimal BasePrice { get; set; }
        public string? Description { get; set; }
        public DateOnly? AvailableFrom { get; set; }
        public DateOnly? AvailableTo { get; set; }
        /// <summary>Booked rooms for today (from daily inventory).</summary>
        public int BookedRooms { get; set; }
        /// <summary>Peak booked rooms across all scheduled nights (minimum allowed total).</summary>
        public int MaxBookedRooms { get; set; }
        /// <summary>Available rooms for today.</summary>
        public int AvailableRooms { get; set; }
    }
}

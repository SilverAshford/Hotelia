namespace HotelBookingApi.DTOs.Hotels
{
    public class HotelResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int Stars { get; set; }
        public string? ThumbnailUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<RoomTypes.RoomTypeResponseDto>? RoomTypes { get; set; }
    }
}

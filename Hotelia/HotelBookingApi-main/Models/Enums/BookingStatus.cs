namespace HotelBookingApi.Models.Enums
{
    public enum BookingStatus
    {
        Pending,      // User submitted request, waiting for admin
        Confirmed,    // Admin approved, room is reserved
        Rejected,     // Admin denied the booking
        Cancelled,    // User cancelled after confirmation
        Completed     // check-out date has passed
    }
}

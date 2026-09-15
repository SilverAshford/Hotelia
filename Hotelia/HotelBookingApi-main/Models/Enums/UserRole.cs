namespace HotelBookingApi.Models.Enums
{
    public enum UserRole
    {
        User,
        Receptionist,  // Can confirm/reject bookings but cannot manage hotels/rooms
        Admin
    }
}

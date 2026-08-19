using HotelBookingApi.DTOs.Bookings;

namespace HotelBookingApi.Services
{
    public interface IBookingService
    {
        Task<BookingResponseDto> CreateBooking(int userId, CreateBookingDto dto);
        Task<BookingResponseDto> ConfirmBooking(int bookingId);
        Task<BookingResponseDto> RejectBooking(int bookingId);
        Task<BookingResponseDto> CancelBooking(int bookingId, int userId);

        /// <summary>Admin cancels any booking (Pending or Confirmed).</summary>
        Task<BookingResponseDto> AdminCancelBooking(int bookingId);

        /// <summary>Mark a Confirmed booking as Completed after check-out.</summary>
        Task<BookingResponseDto> CompleteBooking(int bookingId);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.Bookings;
using HotelBookingApi.Models.Enums;
using HotelBookingApi.Services;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Route("api/admin/bookings")]
    [Authorize(Roles = "Admin")]
    public class AdminBookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;
        private readonly AppDbContext _context;

        public AdminBookingsController(IBookingService bookingService, AppDbContext context)
        {
            _bookingService = bookingService;
            _context = context;
        }

        // GET /api/admin/bookings?status=PENDING
        [HttpGet]
        public async Task<ActionResult<List<BookingResponseDto>>> GetBookings([FromQuery] string? status)
        {
            var query = _context.Bookings
                .Include(b => b.Hotel)
                .Include(b => b.RoomType)
                .Include(b => b.User)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<BookingStatus>(status, true, out var parsed))
                query = query.Where(b => b.Status == parsed);

            var bookings = await query
                .OrderByDescending(b => b.CreatedAt)
                .Select(b => new BookingResponseDto
                {
                    Id = b.Id,
                    UserId = b.UserId,
                    UserName = b.User.Name,
                    HotelId = b.HotelId,
                    HotelName = b.Hotel.Name,
                    RoomTypeId = b.RoomTypeId,
                    RoomTypeName = b.RoomType.Name,
                    CheckIn = b.CheckIn,
                    CheckOut = b.CheckOut,
                    Nights = b.Nights,
                    TotalPrice = b.TotalPrice,
                    Status = b.Status.ToString(),
                    CreatedAt = b.CreatedAt
                })
                .ToListAsync();

            return Ok(bookings);
        }

        // PATCH /api/admin/bookings/{id}/confirm
        [HttpPatch("{id}/confirm")]
        public async Task<ActionResult<BookingResponseDto>> Confirm(int id)
        {
            var result = await _bookingService.ConfirmBooking(id);
            return Ok(result);
        }

        // PATCH /api/admin/bookings/{id}/reject
        [HttpPatch("{id}/reject")]
        public async Task<ActionResult<BookingResponseDto>> Reject(int id)
        {
            var result = await _bookingService.RejectBooking(id);
            return Ok(result);
        }

        // PATCH /api/admin/bookings/{id}/cancel  — Admin cancels any booking
        [HttpPatch("{id}/cancel")]
        public async Task<ActionResult<BookingResponseDto>> AdminCancel(int id)
        {
            var result = await _bookingService.AdminCancelBooking(id);
            return Ok(result);
        }

        // PATCH /api/admin/bookings/{id}/complete  — Mark booking as Completed
        [HttpPatch("{id}/complete")]
        public async Task<ActionResult<BookingResponseDto>> Complete(int id)
        {
            var result = await _bookingService.CompleteBooking(id);
            return Ok(result);
        }
    }
}
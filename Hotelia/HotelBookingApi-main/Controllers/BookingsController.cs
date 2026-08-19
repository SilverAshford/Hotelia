using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.Bookings;
using HotelBookingApi.Services;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Authorize]
    public class BookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;
        private readonly AppDbContext _context;

        public BookingsController(IBookingService bookingService, AppDbContext context)
        {
            _bookingService = bookingService;
            _context = context;
        }

        // Reads the logged-in user's ID from the JWT token
        private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // POST /api/bookings
        [HttpPost("/api/bookings")]
        public async Task<ActionResult<BookingResponseDto>> CreateBooking(CreateBookingDto dto)
        {
            var result = await _bookingService.CreateBooking(CurrentUserId, dto);
            return Ok(result);
        }

        // GET /api/me/bookings
        [HttpGet("/api/me/bookings")]
        public async Task<ActionResult<List<BookingResponseDto>>> GetMyBookings()
        {
            var bookings = await _context.Bookings
                .Include(b => b.Hotel)
                .Include(b => b.RoomType)
                .Include(b => b.User)
                .Where(b => b.UserId == CurrentUserId)
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

        // PATCH /api/bookings/{id}/cancel
        [HttpPatch("/api/bookings/{id}/cancel")]
        public async Task<ActionResult<BookingResponseDto>> CancelBooking(int id)
        {
            var result = await _bookingService.CancelBooking(id, CurrentUserId);
            return Ok(result);
        }
    }
}
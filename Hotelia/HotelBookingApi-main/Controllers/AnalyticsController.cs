using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.Models.Enums;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Route("api/admin/analytics")]
    [Authorize(Roles = "Admin")]  // Only Admin can view analytics
    public class AnalyticsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AnalyticsController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/admin/analytics/overview
        [HttpGet("overview")]
        public async Task<ActionResult<object>> GetOverview()
        {
            var totalHotels = await _context.Hotels.CountAsync();
            var totalRoomTypes = await _context.RoomTypes.CountAsync();
            var totalUsers = await _context.Users.CountAsync(u => u.Role == UserRole.User);
            var totalBookings = await _context.Bookings.CountAsync();

            var pendingBookings = await _context.Bookings
                .CountAsync(b => b.Status == BookingStatus.Pending);

            var confirmedBookings = await _context.Bookings
                .CountAsync(b => b.Status == BookingStatus.Confirmed);

            var completedBookings = await _context.Bookings
                .CountAsync(b => b.Status == BookingStatus.Completed);

            return Ok(new
            {
                totalHotels,
                totalRoomTypes,
                totalUsers,
                totalBookings,
                pendingBookings,
                confirmedBookings,
                completedBookings
            });
        }

        // GET /api/admin/analytics/revenue
        [HttpGet("revenue")]
        public async Task<ActionResult<object>> GetRevenue()
        {
            var allBookings = await _context.Bookings
                .Where(b => b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.Completed)
                .ToListAsync();

            var totalRevenue = allBookings.Sum(b => b.TotalPrice);
            var averageBookingValue = allBookings.Any() ? allBookings.Average(b => b.TotalPrice) : 0;

            // Revenue by month (last 6 months)
            var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);
            var revenueByMonth = await _context.Bookings
                .Where(b => (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.Completed)
                         && b.CreatedAt >= sixMonthsAgo)
                .GroupBy(b => new { b.CreatedAt.Year, b.CreatedAt.Month })
                .Select(g => new
                {
                    year = g.Key.Year,
                    month = g.Key.Month,
                    revenue = g.Sum(b => b.TotalPrice),
                    bookings = g.Count()
                })
                .OrderBy(x => x.year).ThenBy(x => x.month)
                .ToListAsync();

            return Ok(new
            {
                totalRevenue,
                averageBookingValue,
                revenueByMonth
            });
        }

        // GET /api/admin/analytics/occupancy
        [HttpGet("occupancy")]
        public async Task<ActionResult<object>> GetOccupancy()
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var next30Days = today.AddDays(30);

            // Get all room inventory for the next 30 days
            var inventory = await _context.RoomInventories
                .Where(ri => ri.Date >= today && ri.Date < next30Days)
                .ToListAsync();

            if (!inventory.Any())
                return Ok(new { averageOccupancy = 0.0, totalRooms = 0, bookedRooms = 0 });

            var totalRooms = inventory.Sum(ri => ri.TotalRooms);
            var bookedRooms = inventory.Sum(ri => ri.BookedRooms);
            var occupancyRate = totalRooms > 0 ? (double)bookedRooms / totalRooms * 100 : 0;

            return Ok(new
            {
                averageOccupancy = Math.Round(occupancyRate, 1),
                totalRooms,
                bookedRooms,
                availableRooms = totalRooms - bookedRooms
            });
        }

        // GET /api/admin/analytics/top-hotels
        [HttpGet("top-hotels")]
        public async Task<ActionResult<object>> GetTopHotels()
        {
            var topHotels = await _context.Bookings
                .Where(b => b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.Completed)
                .GroupBy(b => new { b.HotelId, b.Hotel.Name })
                .Select(g => new
                {
                    hotelId = g.Key.HotelId,
                    hotelName = g.Key.Name,
                    bookings = g.Count(),
                    revenue = g.Sum(b => b.TotalPrice)
                })
                .OrderByDescending(h => h.revenue)
                .Take(5)
                .ToListAsync();

            return Ok(topHotels);
        }

        // GET /api/admin/analytics/booking-status
        [HttpGet("booking-status")]
        public async Task<ActionResult<object>> GetBookingStatusDistribution()
        {
            var statusDistribution = await _context.Bookings
                .GroupBy(b => b.Status)
                .Select(g => new
                {
                    status = g.Key.ToString(),
                    count = g.Count()
                })
                .ToListAsync();

            return Ok(statusDistribution);
        }
    }
}

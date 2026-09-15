using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.Reviews;
using HotelBookingApi.Models;
using HotelBookingApi.Models.Enums;
using System.Security.Claims;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Route("api/reviews")]
    public class ReviewsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ReviewsController(AppDbContext context)
        {
            _context = context;
        }

        // POST /api/reviews → User creates a review (only after CONFIRMED or COMPLETED booking)
        [HttpPost]
        [Authorize(Roles = "User")]
        public async Task<ActionResult<ReviewResponseDto>> CreateReview(CreateReviewDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            // 1. Check if user has a CONFIRMED or COMPLETED booking for this hotel
            var hasValidBooking = await _context.Bookings
                .AnyAsync(b => b.UserId == userId 
                            && b.HotelId == dto.HotelId 
                            && (b.Status == BookingStatus.Confirmed || b.Status == BookingStatus.Completed));

            if (!hasValidBooking)
                return BadRequest("You can only review hotels you have confirmed bookings for.");

            // 2. Check if user already reviewed this hotel
            var existingReview = await _context.Reviews
                .FirstOrDefaultAsync(r => r.UserId == userId && r.HotelId == dto.HotelId);

            if (existingReview != null)
                return BadRequest("You have already reviewed this hotel.");

            // 3. Verify hotel exists
            var hotel = await _context.Hotels.FindAsync(dto.HotelId);
            if (hotel == null) return NotFound("Hotel not found.");

            // 4. Create review
            var review = new Review
            {
                UserId = userId,
                HotelId = dto.HotelId,
                Rating = dto.Rating,
                Comment = dto.Comment
            };

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            // 5. Load user and hotel for response
            await _context.Entry(review).Reference(r => r.User).LoadAsync();
            await _context.Entry(review).Reference(r => r.Hotel).LoadAsync();

            return CreatedAtAction(nameof(GetReview), new { id = review.Id }, MapToDto(review));
        }

        // PUT /api/reviews/{id} → Update own review
        [HttpPut("{id}")]
        [Authorize(Roles = "User")]
        public async Task<ActionResult<ReviewResponseDto>> UpdateReview(int id, UpdateReviewDto dto)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var review = await _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Hotel)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (review == null) return NotFound();
            if (review.UserId != userId) return Forbid();

            review.Rating = dto.Rating;
            review.Comment = dto.Comment;

            await _context.SaveChangesAsync();
            return Ok(MapToDto(review));
        }

        // GET /api/reviews/{id} → Get single review
        [HttpGet("{id}")]
        public async Task<ActionResult<ReviewResponseDto>> GetReview(int id)
        {
            var review = await _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Hotel)
                .FirstOrDefaultAsync(r => r.Id == id);

            if (review == null) return NotFound();
            return Ok(MapToDto(review));
        }

        // GET /api/hotels/{hotelId}/reviews → Get all reviews for a hotel
        [HttpGet("/api/hotels/{hotelId}/reviews")]
        public async Task<ActionResult<List<ReviewResponseDto>>> GetHotelReviews(int hotelId)
        {
            var reviews = await _context.Reviews
                .Include(r => r.User)
                .Include(r => r.Hotel)
                .Where(r => r.HotelId == hotelId)
                .OrderByDescending(r => r.CreatedAt)
                .ToListAsync();

            return Ok(reviews.Select(MapToDto).ToList());
        }

        // GET /api/hotels/{hotelId}/rating → Get average rating for a hotel
        [HttpGet("/api/hotels/{hotelId}/rating")]
        public async Task<ActionResult<object>> GetHotelRating(int hotelId)
        {
            var reviews = await _context.Reviews
                .Where(r => r.HotelId == hotelId)
                .ToListAsync();

            if (!reviews.Any())
                return Ok(new { averageRating = 0.0, totalReviews = 0 });

            var avgRating = reviews.Average(r => r.Rating);
            return Ok(new { averageRating = Math.Round(avgRating, 1), totalReviews = reviews.Count });
        }

        // DELETE /api/reviews/{id} → Delete own review
        [HttpDelete("{id}")]
        [Authorize(Roles = "User")]
        public async Task<IActionResult> DeleteReview(int id)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var review = await _context.Reviews.FindAsync(id);

            if (review == null) return NotFound();
            if (review.UserId != userId) return Forbid();

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static ReviewResponseDto MapToDto(Review review) => new()
        {
            Id = review.Id,
            UserId = review.UserId,
            UserName = review.User?.Name ?? "Unknown",
            HotelId = review.HotelId,
            HotelName = review.Hotel?.Name ?? "Unknown",
            Rating = review.Rating,
            Comment = review.Comment,
            CreatedAt = review.CreatedAt
        };
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.Hotels;
using HotelBookingApi.DTOs.RoomTypes;
using HotelBookingApi.Models;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Route("api/hotels")]
    public class HotelsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HotelsController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/hotels?city=Cairo
        [HttpGet]
        public async Task<ActionResult<List<HotelResponseDto>>> GetHotels([FromQuery] string? city)
        {
            var query = _context.Hotels.Include(h => h.RoomTypes).AsQueryable();

            if (!string.IsNullOrWhiteSpace(city))
                query = query.Where(h => h.City.ToLower().Contains(city.ToLower()));

            var hotels = await query.ToListAsync();
            return Ok(hotels.Select(MapToDto));
        }

        // GET /api/hotels/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<HotelResponseDto>> GetHotel(int id)
        {
            var hotel = await _context.Hotels
                .Include(h => h.RoomTypes)
                .FirstOrDefaultAsync(h => h.Id == id);

            if (hotel == null) return NotFound();
            return Ok(MapToDto(hotel));
        }

        // POST /api/admin/hotels
        [HttpPost("/api/admin/hotels")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<HotelResponseDto>> CreateHotel(CreateHotelDto dto)
        {
            var hotel = new Hotel
            {
                Name = dto.Name,
                City = dto.City,
                Address = dto.Address,
                Description = dto.Description,
                Stars = dto.Stars,
                ThumbnailUrl = dto.ThumbnailUrl
            };

            _context.Hotels.Add(hotel);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetHotel), new { id = hotel.Id }, MapToDto(hotel));
        }

        // PUT /api/admin/hotels/{id}
        [HttpPut("/api/admin/hotels/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<HotelResponseDto>> UpdateHotel(int id, UpdateHotelDto dto)
        {
            var hotel = await _context.Hotels.FindAsync(id);
            if (hotel == null) return NotFound();

            if (dto.Name != null) hotel.Name = dto.Name;
            if (dto.City != null) hotel.City = dto.City;
            if (dto.Address != null) hotel.Address = dto.Address;
            if (dto.Description != null) hotel.Description = dto.Description;
            if (dto.Stars.HasValue) hotel.Stars = dto.Stars.Value;
            if (dto.ThumbnailUrl != null) hotel.ThumbnailUrl = dto.ThumbnailUrl;

            await _context.SaveChangesAsync();
            return Ok(MapToDto(hotel));
        }

        // DELETE /api/admin/hotels/{id}
        [HttpDelete("/api/admin/hotels/{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteHotel(int id)
        {
            var hotel = await _context.Hotels.FindAsync(id);
            if (hotel == null) return NotFound();

            _context.Hotels.Remove(hotel);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static HotelResponseDto MapToDto(Hotel hotel) => new()
        {
            Id = hotel.Id,
            Name = hotel.Name,
            City = hotel.City,
            Address = hotel.Address,
            Description = hotel.Description,
            Stars = hotel.Stars,
            ThumbnailUrl = hotel.ThumbnailUrl,
            CreatedAt = hotel.CreatedAt,
            RoomTypes = hotel.RoomTypes?.Select(rt => new RoomTypeResponseDto
            {
                Id = rt.Id,
                HotelId = rt.HotelId,
                Name = rt.Name,
                Capacity = rt.Capacity,
                BedType = rt.BedType,
                BasePrice = rt.BasePrice,
                Description = rt.Description
            }).ToList()
        };
    }
}
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
            
            // Map hotels with room stats asynchronously
            var hotelsWithStats = new List<HotelResponseDto>();
            foreach (var hotel in hotels)
            {
                hotelsWithStats.Add(await MapToDtoWithRoomStatsAsync(hotel));
            }
            
            return Ok(hotelsWithStats);
        }

        // GET /api/hotels/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<HotelResponseDto>> GetHotel(int id)
        {
            var hotel = await _context.Hotels
                .Include(h => h.RoomTypes)
                .FirstOrDefaultAsync(h => h.Id == id);

            if (hotel == null) return NotFound();
            return Ok(await MapToDtoWithRoomStatsAsync(hotel));
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
            // Load hotel with all related entities
            var hotel = await _context.Hotels
                .Include(h => h.RoomTypes)
                .FirstOrDefaultAsync(h => h.Id == id);

            if (hotel == null) return NotFound();

            // Step 1: Delete all bookings related to any room type in this hotel
            var roomTypeIds = hotel.RoomTypes.Select(rt => rt.Id).ToList();
            var bookings = await _context.Bookings
                .Where(b => roomTypeIds.Contains(b.RoomTypeId))
                .ToListAsync();
            _context.Bookings.RemoveRange(bookings);

            // Step 2: Delete all room inventory records for these room types
            var inventoryRecords = await _context.RoomInventories
                .Where(ri => roomTypeIds.Contains(ri.RoomTypeId))
                .ToListAsync();
            _context.RoomInventories.RemoveRange(inventoryRecords);

            // Step 3: Delete all room types
            _context.RoomTypes.RemoveRange(hotel.RoomTypes);

            // Step 4: Finally delete the hotel
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
            RoomTypes = hotel.RoomTypes?.Select(MapRoomType).ToList()
        };

        private async Task<HotelResponseDto> MapToDtoWithRoomStatsAsync(Hotel hotel)
        {
            var dto = MapToDto(hotel);
            if (dto.RoomTypes == null || dto.RoomTypes.Count == 0)
                return dto;

            Console.WriteLine($"=== MapToDtoWithRoomStatsAsync for Hotel {hotel.Id} ({hotel.Name}) ===");
            
            var roomTypeIds = dto.RoomTypes.Select(rt => rt.Id).ToList();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var inventories = await _context.RoomInventories
                .Where(ri => roomTypeIds.Contains(ri.RoomTypeId) && ri.Date >= today)
                .ToListAsync();

            Console.WriteLine($"Total future/current inventories for hotel: {inventories.Count}");

            // Group inventories by room type
            var inventoriesByRoom = inventories
                .GroupBy(ri => ri.RoomTypeId)
                .ToDictionary(g => g.Key, g => g.ToList());

            var peakBookedByRoom = inventories
                .GroupBy(ri => ri.RoomTypeId)
                .ToDictionary(g => g.Key, g => g.Max(x => x.BookedRooms));

            foreach (var rt in dto.RoomTypes)
            {
                Console.WriteLine($"\n--- Room Type {rt.Id} ({rt.Name}) ---");
                
                // Get current or next available inventory record for this room type
                var roomInventories = inventoriesByRoom.GetValueOrDefault(rt.Id);
                Console.WriteLine($"Future inventories for this room: {roomInventories?.Count ?? 0}");
                
                // Get the most recently booked date (showing actual booking activity)
                var currentInv = roomInventories?
                    .Where(ri => ri.BookedRooms > 0)
                    .OrderByDescending(ri => ri.BookedRooms)
                    .ThenBy(ri => ri.Date)
                    .FirstOrDefault();
                
                // If no bookings found, use earliest available date
                if (currentInv == null && roomInventories != null && roomInventories.Count > 0)
                {
                    currentInv = roomInventories
                        .OrderBy(ri => ri.Date)
                        .FirstOrDefault();
                }

                if (currentInv != null)
                {
                    Console.WriteLine($"Selected: Date={currentInv.Date}, Total={currentInv.TotalRooms}, Booked={currentInv.BookedRooms}");
                }
                else
                {
                    Console.WriteLine("⚠️ No inventory found!");
                }

                peakBookedByRoom.TryGetValue(rt.Id, out var peakBooked);

                rt.BookedRooms = currentInv?.BookedRooms ?? 0;
                rt.MaxBookedRooms = peakBooked;
                rt.AvailableRooms = currentInv != null
                    ? currentInv.TotalRooms - currentInv.BookedRooms
                    : rt.TotalRooms;
                    
                Console.WriteLine($"Result: BookedRooms={rt.BookedRooms}, AvailableRooms={rt.AvailableRooms}");
            }

            Console.WriteLine("=== End MapToDtoWithRoomStatsAsync ===\n");
            return dto;
        }

        private static RoomTypeResponseDto MapRoomType(RoomType rt) => new()
        {
            Id = rt.Id,
            HotelId = rt.HotelId,
            Name = rt.Name,
            Capacity = rt.Capacity,
            TotalRooms = rt.TotalRooms,
            BedType = rt.BedType,
            BasePrice = rt.BasePrice,
            Description = rt.Description,
            AvailableFrom = rt.AvailableFrom,
            AvailableTo = rt.AvailableTo
        };
    }
}
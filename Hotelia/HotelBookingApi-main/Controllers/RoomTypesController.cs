using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.RoomTypes;
using HotelBookingApi.Models;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class RoomTypesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RoomTypesController(AppDbContext context)
        {
            _context = context;
        }

        // POST /api/admin/hotels/{hotelId}/room-types
        [HttpPost("/api/admin/hotels/{hotelId}/room-types")]
        public async Task<ActionResult<RoomTypeResponseDto>> CreateRoomType(int hotelId, CreateRoomTypeDto dto)
        {
            var hotelExists = await _context.Hotels.AnyAsync(h => h.Id == hotelId);
            if (!hotelExists) return NotFound("Hotel not found.");
            if (dto.AvailableFrom >= dto.AvailableTo)
                return BadRequest("Check-out date must be after check-in date.");

            var roomType = new RoomType
            {
                HotelId = hotelId,
                Name = dto.Name,
                Capacity = dto.Capacity,
                TotalRooms = dto.TotalRooms,
                BedType = dto.BedType,
                BasePrice = dto.BasePrice,
                Description = dto.Description,
                AvailableFrom = dto.AvailableFrom,
                AvailableTo = dto.AvailableTo
            };

            _context.RoomTypes.Add(roomType);
            ApplyAvailabilityWindow(roomType, dto.AvailableFrom, dto.AvailableTo, dto.TotalRooms);
            await _context.SaveChangesAsync();

            return Ok(await MapToDtoWithStatsAsync(roomType));
        }

        // PUT /api/admin/room-types/{id}
        [HttpPut("/api/admin/room-types/{id}")]
        public async Task<ActionResult<RoomTypeResponseDto>> UpdateRoomType(int id, UpdateRoomTypeDto dto)
        {
            var roomType = await _context.RoomTypes.FindAsync(id);
            if (roomType == null) return NotFound();

            if (dto.Name != null) roomType.Name = dto.Name;
            if (dto.Capacity.HasValue) roomType.Capacity = dto.Capacity.Value;
            if (dto.BedType != null) roomType.BedType = dto.BedType;
            if (dto.BasePrice.HasValue) roomType.BasePrice = dto.BasePrice.Value;
            if (dto.Description != null) roomType.Description = dto.Description;
            if (dto.TotalRooms.HasValue) roomType.TotalRooms = dto.TotalRooms.Value;

            var availableFrom = dto.AvailableFrom ?? roomType.AvailableFrom;
            var availableTo = dto.AvailableTo ?? roomType.AvailableTo;
            if (availableFrom.HasValue != availableTo.HasValue)
                return BadRequest("Select both check-in and check-out dates.");

            if (availableFrom.HasValue && availableTo.HasValue)
            {
                if (availableFrom.Value >= availableTo.Value)
                    return BadRequest("Check-out date must be after check-in date.");

                try
                {
                    ApplyAvailabilityWindow(roomType, availableFrom.Value, availableTo.Value, roomType.TotalRooms);
                }
                catch (InvalidOperationException ex)
                {
                    return BadRequest(ex.Message);
                }

                roomType.AvailableFrom = availableFrom;
                roomType.AvailableTo = availableTo;
            }

            await _context.SaveChangesAsync();
            return Ok(await MapToDtoWithStatsAsync(roomType));
        }

        // DELETE /api/admin/room-types/{id}
        [HttpDelete("/api/admin/room-types/{id}")]
        public async Task<IActionResult> DeleteRoomType(int id)
        {
            var roomType = await _context.RoomTypes.FindAsync(id);
            if (roomType == null) return NotFound();

            // Step 1: Delete all bookings for this room type
            var bookings = await _context.Bookings
                .Where(b => b.RoomTypeId == id)
                .ToListAsync();
            _context.Bookings.RemoveRange(bookings);

            // Step 2: Delete all inventory records for this room type
            var inventoryRecords = await _context.RoomInventories
                .Where(ri => ri.RoomTypeId == id)
                .ToListAsync();
            _context.RoomInventories.RemoveRange(inventoryRecords);

            // Step 3: Finally delete the room type
            _context.RoomTypes.Remove(roomType);

            await _context.SaveChangesAsync();
            return NoContent();
        }

        private static RoomTypeResponseDto MapToDto(RoomType rt) => new()
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

        private async Task<RoomTypeResponseDto> MapToDtoWithStatsAsync(RoomType rt)
        {
            var dto = MapToDto(rt);
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            var inventories = await _context.RoomInventories
                .Where(ri => ri.RoomTypeId == rt.Id && ri.Date >= today)
                .ToListAsync();

            Console.WriteLine($"=== MapToDtoWithStatsAsync for Room Type {rt.Id} ({rt.Name}) ===");
            Console.WriteLine($"Today: {today}");
            Console.WriteLine($"Total future/current inventories found: {inventories.Count}");

            // Prioritize showing dates with actual bookings
            var currentInv = inventories
                .Where(ri => ri.BookedRooms > 0)
                .OrderByDescending(ri => ri.BookedRooms)
                .ThenBy(ri => ri.Date)
                .FirstOrDefault();
            
            // If no bookings, use earliest available date
            if (currentInv == null && inventories.Any())
            {
                currentInv = inventories
                    .OrderBy(ri => ri.Date)
                    .FirstOrDefault();
                    
                if (currentInv != null)
                {
                    Console.WriteLine($"No bookings. Using earliest date: {currentInv.Date}");
                }
            }
            else if (currentInv != null)
            {
                Console.WriteLine($"Found booking on: {currentInv.Date}");
            }
            
            if (currentInv != null)
            {
                Console.WriteLine($"Selected inventory: Date={currentInv.Date}, Total={currentInv.TotalRooms}, Booked={currentInv.BookedRooms}, Available={currentInv.AvailableRooms}");
            }
            else
            {
                Console.WriteLine("⚠️ No current inventory found!");
            }
            
            var peakBooked = inventories.Any() ? inventories.Max(x => x.BookedRooms) : 0;

            dto.BookedRooms = currentInv?.BookedRooms ?? 0;
            dto.MaxBookedRooms = peakBooked;
            dto.AvailableRooms = currentInv != null
                ? currentInv.TotalRooms - currentInv.BookedRooms
                : rt.TotalRooms;

            Console.WriteLine($"Returning DTO: BookedRooms={dto.BookedRooms}, AvailableRooms={dto.AvailableRooms}, MaxBookedRooms={dto.MaxBookedRooms}");
            Console.WriteLine("=== End MapToDtoWithStatsAsync ===\n");

            return dto;
        }

        private void ApplyAvailabilityWindow(RoomType roomType, DateOnly from, DateOnly to, int totalRooms)
        {
            var existing = _context.RoomInventories
                .Where(ri => ri.RoomTypeId == roomType.Id)
                .ToList();

            var removedWithBookings = existing.FirstOrDefault(ri =>
                (ri.Date < from || ri.Date >= to) && ri.BookedRooms > 0);
            if (removedWithBookings != null)
                throw new InvalidOperationException($"Cannot remove availability for {removedWithBookings.Date}: it already has bookings.");

            var reducedBelowBookings = existing.FirstOrDefault(ri =>
                ri.Date >= from && ri.Date < to && ri.BookedRooms > totalRooms);
            if (reducedBelowBookings != null)
                throw new InvalidOperationException($"Cannot set {totalRooms} rooms on {reducedBelowBookings.Date}: {reducedBelowBookings.BookedRooms} are already booked.");

            _context.RoomInventories.RemoveRange(existing.Where(ri => ri.Date < from || ri.Date >= to));

            var byDate = existing
                .Where(ri => ri.Date >= from && ri.Date < to)
                .ToDictionary(ri => ri.Date);
            for (var date = from; date < to; date = date.AddDays(1))
            {
                if (byDate.TryGetValue(date, out var inventory))
                    inventory.TotalRooms = totalRooms;
                else
                    _context.RoomInventories.Add(new RoomInventory
                    {
                        RoomType = roomType,
                        Date = date,
                        TotalRooms = totalRooms
                    });
            }
        }
    }
}

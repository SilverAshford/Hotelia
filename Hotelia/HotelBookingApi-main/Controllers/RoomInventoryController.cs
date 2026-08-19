using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using HotelBookingApi.Data;
using HotelBookingApi.DTOs.RoomInventory;
using HotelBookingApi.Models;

namespace HotelBookingApi.Controllers
{
    [ApiController]
    public class RoomInventoryController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RoomInventoryController(AppDbContext context)
        {
            _context = context;
        }

        // GET /api/room-types/{id}/availability?from=2026-08-20&to=2026-08-25
        [HttpGet("/api/room-types/{id}/availability")]
        public async Task<ActionResult<List<AvailabilityResponseDto>>> GetAvailability(
            int id, [FromQuery] DateOnly from, [FromQuery] DateOnly to)
        {
            if (from >= to)
                return BadRequest("`from` must be earlier than `to`.");

            var records = await _context.RoomInventories
                .Where(ri => ri.RoomTypeId == id && ri.Date >= from && ri.Date < to)
                .OrderBy(ri => ri.Date)
                .Select(ri => new AvailabilityResponseDto
                {
                    Date = ri.Date,
                    TotalRooms = ri.TotalRooms,
                    BookedRooms = ri.BookedRooms,
                    AvailableRooms = ri.AvailableRooms
                })
                .ToListAsync();

            return Ok(records);
        }

        // PUT /api/admin/room-inventory
        [HttpPut("/api/admin/room-inventory")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<AvailabilityResponseDto>> SetInventory(SetInventoryDto dto)
        {
            var roomTypeExists = await _context.RoomTypes.AnyAsync(rt => rt.Id == dto.RoomTypeId);
            if (!roomTypeExists) return NotFound("Room type not found.");

            var inventory = await _context.RoomInventories
                .FirstOrDefaultAsync(ri => ri.RoomTypeId == dto.RoomTypeId && ri.Date == dto.Date);

            if (inventory == null)
            {
                inventory = new RoomInventory
                {
                    RoomTypeId = dto.RoomTypeId,
                    Date = dto.Date,
                    TotalRooms = dto.TotalRooms
                };
                _context.RoomInventories.Add(inventory);
            }
            else
            {
                inventory.TotalRooms = dto.TotalRooms;
            }

            await _context.SaveChangesAsync();

            return Ok(new AvailabilityResponseDto
            {
                Date = inventory.Date,
                TotalRooms = inventory.TotalRooms,
                BookedRooms = inventory.BookedRooms,
                AvailableRooms = inventory.AvailableRooms
            });
            }

            // PATCH /api/admin/room-inventory/adjust
            [HttpPatch("/api/admin/room-inventory/adjust")]
            [Authorize(Roles = "Admin")]
            public async Task<IActionResult> AdjustInventory(AdjustInventoryDto dto)
            {
                if (dto.From >= dto.To)
                    return BadRequest("`From` must be earlier than `To`.");

                var roomTypeExists = await _context.RoomTypes.AnyAsync(rt => rt.Id == dto.RoomTypeId);
                if (!roomTypeExists) return NotFound("Room type not found.");

                var records = await _context.RoomInventories
                    .Where(ri => ri.RoomTypeId == dto.RoomTypeId && ri.Date >= dto.From && ri.Date < dto.To)
                    .ToListAsync();

                // Safety check: don't let TotalRooms drop below already-booked rooms on any date
                var conflict = records.FirstOrDefault(r => r.TotalRooms + dto.Delta < r.BookedRooms);
                if (conflict != null)
                    return BadRequest($"Cannot apply — {conflict.BookedRooms} room(s) already booked on {conflict.Date}.");

                foreach (var r in records)
                    r.TotalRooms += dto.Delta;

                await _context.SaveChangesAsync();

                return Ok(new { updatedDates = records.Count, delta = dto.Delta });
            }
    }
}